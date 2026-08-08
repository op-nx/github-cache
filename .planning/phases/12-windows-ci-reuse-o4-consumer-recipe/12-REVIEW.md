---
phase: 12-windows-ci-reuse-o4-consumer-recipe
reviewed: 2026-07-30T21:20:28Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/windows-regression-detector.yml
  - capture-hashes.mjs
  - docs/advanced.md
  - docs/cross-os.md
  - eslint.config.mjs
  - nx.json
  - packages/github-cache/src/docs-cross-os.spec.ts
  - packages/github-cache/src/dogfood-cross-os.spec.ts
  - packages/github-cache/src/hash-parity/compare.spec.ts
  - packages/github-cache/src/hash-parity/compare.ts
  - packages/github-cache/src/nx-target-inputs.spec.ts
  - packages/github-cache/src/windows-regression-detector.spec.ts
  - README.md
findings:
  critical: 1
  warning: 9
  info: 6
  total: 16
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-07-30T21:20:28Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Presence and structure were not re-verified -- the verifier already established
that. This review attacked the two things a shape guard structurally cannot
reach: whether `docs/cross-os.md` is CORRECT as advice an outside project acts
on, and whether the new guards can actually fail.

The single highest-impact finding is CR-01: section 1 of `docs/cross-os.md`
instructs the reader to declare the discriminator on EVERY cacheable target, and
then hands them a copy-pasteable snippet that declares it on exactly ONE target
-- `integration`, which is this repository's EARNED EXCEPTION, the one target
that kept the discriminator because its output is NOT portable. A consumer who
copies the artifact gets the configuration the doc's own asymmetry paragraph
calls the wrong-result mistake. The drift guard proves the doc says the right
things; it cannot see that the artifact under the heading contradicts the
heading.

Two guard weaknesses are half-locks of the class this repo keeps recording
against itself. WR-06: the three Windows legs' `sidecar` clause pins
`- uses: ./start-cache-server` and `- cancel: cache-server` but not the
`NX_SELF_HOSTED_REMOTE_CACHE_*` pre-set step or the readiness poll -- delete the
pre-set step and every clause stays green while the leg runs with no remote
cache client at all, which is precisely the "goes green having proved nothing"
mode that clause's own failure message describes. WR-05: the detector's "proves
the run happened" clause asserts only that `NO_COLOR` and the success-line needle
appear SOMEWHERE in the file; nothing ties the needle to a gating `grep -q`, and
nothing ties `--skip-nx-cache` to the same invocation as the three targets. The
repo's own stronger precedent (`dogfood-cross-os.spec.ts:449`, which pins the
whole grep expression) is one file away.

Three claim-accuracy defects survived the phase's own correction sweep (WR-07,
WR-08, IN-01), which matters more than usual here because "a comment carrying a
false reason is a documented argument for undoing the work" is this phase's own
stated standard.

The graph-premise corrections in `capture-hashes.mjs` (both the constant's
doc-comment and assertion 2's message) are TRUE as rewritten: `integration`
carries `dependsOn: ["^build"]` and this workspace has no project dependencies,
so the resolved set genuinely contains no `build`/`typecheck`/`test` task, and
the three new legs declare no new target and no new `dependsOn`. The withdrawal
of producer attribution is correct and is the honest reading. No finding.

The D-15 sweep is genuinely complete: the retired spelling has zero live sites
outside `.planning/`, and the new spelling occurs at exactly 11 sites, verified
with a positive control in the identical command shape.

## Structural Findings (fallow)

fallow 3.6.0 `audit --changed-since 0251bd3` -- verdict: **pass**, 28 changed
files.

- summary: dead_code_issues 0, dead_code_has_errors false, complexity_findings 5,
  max_cyclomatic 14, duplication_clone_groups 0
- attribution (gate `new-only`): dead_code_introduced 0, dead_code_inherited 0,
  complexity_introduced 0, complexity_inherited 5, duplication_introduced 0,
  duplication_inherited 5 -> 0

All five complexity findings are INHERITED (`introduced: false`):

| Site | Cyclomatic | Cognitive | CRAP | Severity |
| --- | --- | --- | --- | --- |
| `compare.ts` `shapeFault` L200 | 14 | 18 | 56.3 | high |
| `compare.ts` `compareHashParity` L300 | 14 | 19 | -- | moderate |
| `capture-hashes.mjs` `diff` L839 | 12 | 13 | 43.1 | moderate |
| (2 more, same inherited character) | -- | -- | -- | -- |

Judged against this phase's edits: this phase touched `compare.ts` only in its
module doc-comment (one literal, one rewrap) and `capture-hashes.mjs` only in a
constant's doc-comment and one error-message string. Neither `shapeFault`,
`compareHashParity` nor `diff` gained a branch. **This phase made none of the
five worse.** Recorded as pre-existing context, not as phase-12 findings.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `docs/cross-os.md` section 1's only copy-pasteable snippet is the EXCEPTION, presented as the SAFE DEFAULT

**File:** `docs/cross-os.md:17-51`
**Severity:** BLOCKER

**Issue:**

The heading and the body instruct the maximum:

```
## 1. The safe default: declare the discriminator on every cacheable target

Declare the platform discriminator on ALL cacheable targets, then remove it from
one target only after you have PROVEN that that target's output is portable.
```

Four lines later the reader is handed the only configuration snippet in the
document, and it declares the discriminator on exactly ONE target:

```json
{
  "targetDefaults": {
    "integration": {
      "inputs": ["default", "^production", { "runtime": "node --no-warnings -p process.platform" }]
    }
  }
}
```

That is not an illustration of the safe default. It is `nx.json:92-107` verbatim
-- this repository's END state, after `build`, `typecheck`, `test` and `lint`
EARNED their removals through section 2's checklist and a build-gating two-leg
comparison. `integration` is the one target that kept the discriminator BECAUSE
its output is not portable.

Three consequences for a consumer who copies it, which is the one thing this
document exists to be copied for:

1. Most adopters have no target named `integration`, so the pasted block is an
   inert `targetDefaults` entry for a target that does not exist. It applies to
   nothing.
2. Their real cacheable targets -- `build`, `test`, `lint` -- keep NO
   discriminator. That is the exact configuration section 1's own asymmetry
   paragraph names as the non-recoverable mistake: "Omitting it where it was
   needed hands a Linux-produced result to a Windows consumer and reports a
   cache hit -- a wrong result, not a slow one." The reader believes they
   followed the safe default and is standing in the unsafe one.
3. `"^production"` references a `production` namedInput. Nx supplies a built-in
   fallback for `default`; it supplies none for `production`. In a workspace that
   does not define one the pasted block is a hash-time error, not a working
   starting point. The two leading entries are this repository's input list, not
   a universal base, and nothing says so.

The `docs-cross-os` guard cannot see any of this. Its discriminator clause
(`docs-cross-os.spec.ts:132-139`) asserts the command string appears exactly
twice, and its ordering clause asserts section 1 precedes section 2. Both are
satisfied by a snippet that demonstrates the opposite of its own heading.

**Fix:**

Make the snippet under section 1 demonstrate section 1. Show the maximum
configuration, keep the earned exception as a separate, clearly labelled
"what this repository ended up with" example, and name the two leading entries
as workspace-specific:

````markdown
Applied to a workspace's cacheable targets, that means every one of them, not
one of them. Replace the target names with your own, and replace `"default"` /
`"^production"` with YOUR target's existing input list (see section 1's
replacement warning below -- these two entries are this repository's, not a
universal base):

```json
{
  "targetDefaults": {
    "build": {
      "inputs": ["...your build inputs...", { "runtime": "node --no-warnings -p process.platform" }]
    },
    "test": {
      "inputs": ["...your test inputs...", { "runtime": "node --no-warnings -p process.platform" }]
    },
    "lint": {
      "inputs": ["...your lint inputs...", { "runtime": "node --no-warnings -p process.platform" }]
    }
  }
}
```

This repository's own `nx.json` no longer looks like that -- it declares the
discriminator on `integration` ALONE. That is the END of section 2, not its
start: the other four targets earned their removal against a build-gating
two-leg hash comparison. Do not read it as a starting point.
````

Then raise `RENDERED_DISCRIMINATOR_SITES` in `docs-cross-os.spec.ts:130` to the
new measured count in the SAME commit, per that constant's own instruction.

## Warnings

### WR-01: The doc warns that `inputs` REPLACES the inferred list, but never names the consequence or how to recover it

**File:** `docs/cross-os.md:46-51`
**Severity:** WARNING

**Issue:** The paragraph reads:

> `targetDefaults.<target>.inputs` REPLACES the inferred input list rather than
> merging into it, so declaring an input means ADDING A LINE to the whole list --
> nothing your plugin inferred survives beside it.

"ADDING A LINE" is the wrong mental model and it is the first half of the
sentence, so it is what a fast reader keeps. The action the reader must actually
take is: enumerate the plugin-inferred list, reproduce ALL of it, then append
the discriminator. Two things are missing:

- **The consequence is never named.** An incomplete replacement list means Nx
  hashes fewer inputs than the task consumes -- under-hashing -- and the failure
  mode of under-hashing is a cache HIT that serves a stale artifact. That is a
  WRONG RESULT, the same severity class the doc's asymmetry paragraph reserves
  for the missing discriminator. This repository has already paid it: `test`
  needs a 25-entry explicit list (`nx.json:50-90`) precisely because the
  replacement dropped everything `@nx/vitest` infers.
- **No recovery procedure.** The doc never tells the reader how to READ the
  inferred list before destroying it.

**Fix:** After the replacement sentence, add:

```markdown
Read the inferred list BEFORE you replace it:

    nx show project <project> --json | jq '.targets["<target>"].inputs'

Reproduce every entry, then append the discriminator. An input you drop is an
input Nx stops hashing, and a task that stops hashing an input it consumes gets
a HIT on a stale entry -- a wrong result, the same class as the missing
discriminator, arriving through a different door.
```

### WR-02: The cross-OS recipe omits the line-ending prerequisite this repository itself ships

**File:** `docs/cross-os.md:131-138`
**Severity:** WARNING

**Issue:** Section 4 names Nx's stream trimming as "the one line-ending hazard
on this path you do not have to handle" and closes with "Every other line-ending
difference in your inputs is still yours to manage" -- and then stops. The
document never names the mitigation, even though it is one line and this
repository already ships and comments it (`.gitattributes`: `* text=auto eol=lf`,
whose own comment reads "breaking cross-OS cache hits").

The uncovered case is the DEFAULT case, not an edge: GitHub's Windows runners
default to `core.autocrlf=true`, so a checkout on `windows-11-arm` gets CRLF in
every text file while `ubuntu-24.04-arm` gets LF. Nx hashes file CONTENTS. With
different bytes, EVERY file-based input diverges, every task hash diverges, and
the entire recipe yields a 0% cross-OS hit rate -- with no error, because a MISS
is never self-evidencing. A reader who follows this document exactly on a
Windows runner gets nothing, and section 4's framing steers them away from
suspecting line endings.

This is a MISS rather than a wrong result, which is why it is a WARNING and not a
blocker. It is nonetheless the single most consequential omission in the
document.

**Fix:** Add to section 4, after the trimming paragraph:

```markdown
The one you DO have to handle, and it is a prerequisite rather than a footnote:
normalise your checkout. GitHub's Windows runners default to
`core.autocrlf=true`, so without a `.gitattributes` your Windows checkout is CRLF
and your Linux checkout is LF. Nx hashes file CONTENTS, so every file-based input
diverges, every task hash diverges, and cross-OS hits go to zero -- silently,
because a MISS reports nothing. One line at the repository root fixes it:

    * text=auto eol=lf
```

### WR-03: Section 3 attributes the libc gap to arm64, and hands over the axis swap with no verification bar

**File:** `docs/cross-os.md:119-129`
**Severity:** WARNING

**Issue:** Two separate problems in one short section.

(a) The stated reason does not support half the claim:

> It does not cover CPU architecture and it does not cover libc, and this project
> cannot exercise either -- every machine here is arm64.

"Every machine here is arm64" explains why the ARCHITECTURE axis is unexercised.
It does not explain the libc axis at all -- libc is unexercised because both
Linux environments are glibc, and glibc-vs-musl varies freely WITHIN arm64. As
written, a reader can take "I am arm64 everywhere" as covering both, which is
false and is exactly the case the next paragraph then names as uncovered.

Note that the drift guard actively pushes this shape: `docs-cross-os.spec.ts:182`
requires `architecture`, `libc` and `arm64` in ONE sentence
(`/architecture[^.!?]{0,80}libc[^.!?]{0,80}arm64/i`), which structurally invites
attaching one reason to two axes.

(b) The axis swap is handed over with no bar:

> The same `runtime` mechanism carries it; only the command changes.

Every property section 1's verification fence demands is scoped there to "each
operating system you cache across". A reader swapping in an architecture or libc
command is never told the replacement must ALSO print a non-empty token, keep
stderr empty (fence item (b): a PID-carrying warning gives a permanent 100% MISS
that presents as a portability failure), and differ on the axis they actually
vary. A libc probe is materially harder to get right than `process.platform` --
the usual `process.report.getReport().header.glibcVersionRuntime` is ABSENT on
musl, which yields `undefined`, which prints and hashes.

**Fix:** Split the reason, and restate the bar:

```markdown
`process.platform` is an operating-system read and nothing more. It does not
cover CPU architecture -- this project cannot exercise that axis, because every
machine here is arm64. It does not cover libc either, for a separate reason:
both Linux environments here are glibc, and glibc-versus-musl varies freely
WITHIN one architecture, so arm64-everywhere buys you nothing on that axis.

...The same `runtime` mechanism carries it; only the command changes -- but the
replacement command must clear the SAME bar section 1 sets: a non-empty token,
an EMPTY stderr (both streams are hashed), and a value that genuinely differs on
the axis you vary. Verify all three on your own runners before you trust it.
```

### WR-04: "Nx's two cache-directory environment variables" is a completeness claim, and it is incomplete

**File:** `docs/cross-os.md:110-117`
**Severity:** WARNING

**Issue:** Checklist item 5 reads "Point Nx's two cache-directory environment
variables, `NX_WORKSPACE_DATA_DIRECTORY` and `NX_NATIVE_FILE_CACHE_DIRECTORY`, at
a temporary directory. That is cold BY CONSTRUCTION".

"Nx's two cache-directory environment variables" asserts that these are ALL of
them. Nx also has `NX_CACHE_DIRECTORY`, which relocates the TASK-RESULTS cache.
For the item's own stated purpose (reproducing a hash measurement) the two named
are sufficient, but the sentence does not say that -- and the reader arrives here
directly from item 3, whose subject is what does and does not constitute a cold
state. A reader who follows item 5 expecting cold and then measures a cache HIT
is looking at a local task-cache hit and will attribute it to the remote tier.

**Fix:** Scope the claim instead of asserting completeness:

```markdown
Point the two variables that govern Nx's GRAPH and plugin-inference state,
`NX_WORKSPACE_DATA_DIRECTORY` and `NX_NATIVE_FILE_CACHE_DIRECTORY`, at a
temporary directory. Those two are what a HASH measurement depends on. If you
are measuring cache HITS rather than hashes, redirect `NX_CACHE_DIRECTORY` too,
or a local task-cache hit will masquerade as a remote one.
```

### WR-05: The detector's "proves the run happened" clause cannot tell a gating grep from a decorative one

**File:** `packages/github-cache/src/windows-regression-detector.spec.ts:130-153`
**Severity:** WARNING

**Issue:** Two clauses carry the whole "this workflow actually detects
something" contract, and both are bare file-wide `toContain` calls against the
comment-stripped text:

```ts
expect(codeLines, reason).toContain('--skip-nx-cache');   // line 137
expect(codeLines, reason).toContain('NO_COLOR');           // line 151
expect(codeLines, reason).toContain(MULTI_TARGET_SUCCESS_LINE); // line 152
```

Neither the flag nor the needle is tied to anything. Concretely, all three of
these edits leave the entire file green while the detector stops detecting:

- `grep -q '...' detector.log` becomes `grep '...' detector.log || true`. The
  needle string is still present; the gate is gone, and the step now passes on
  "NX No tasks were run", which is the exact measured failure the clause's own
  reason text cites.
- The needle moves into an `echo`/comment-free banner line and the grep is
  deleted outright. Still `toContain`-satisfied.
- `--skip-nx-cache` migrates onto a different command in a second step (say an
  `nx reset --skip-nx-cache` warm-up) while the three-target run keeps the cache.
  Both clauses pass; the run replays Linux artifacts, which the reason text calls
  "a slower copy of the ci.yml Windows legs".

The repo already has the correct shape for exactly this control, one file over:
`dogfood-cross-os.spec.ts:449` pins
`/grep -q '\^o3-witness: EXISTENCE OK' o3-witness\.log/` -- the whole expression,
not the needle. This guard is materially weaker than its own precedent.

**Fix:** Pin the gating expression and the single invocation:

```ts
it('proves the run happened, rather than inferring it from an exit code', () => {
  expect(codeLines, reason).toContain('NO_COLOR');
  // The GATING form, not merely the needle: `grep '...' || true` keeps the
  // string and deletes the gate.
  expect(codeLines, reason).toMatch(
    new RegExp(`grep -q '${MULTI_TARGET_SUCCESS_LINE}' \\S+\\.log`),
  );
});

it('bypasses the Nx cache on the SAME invocation that runs the three targets', () => {
  // One line carrying all three targets AND the flag -- so the flag cannot
  // drift onto a different command while this clause stays green.
  expect(codeLines, reason).toMatch(
    /nx run-many -t build typecheck test --skip-nx-cache/,
  );
});
```

### WR-06: The Windows legs' `sidecar` clause does not guard the thing that makes the leg a consumer

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:613-618, 668-673, 718-723, 768-773`
**Severity:** WARNING

**Issue:** Each leg's sidecar clause asserts exactly two lines:

```ts
expect(block, sidecar).toMatch(/^ {6}- uses: \.\/start-cache-server$/m);
expect(block, sidecar).toMatch(/^ {6}- cancel: cache-server$/m);
```

Its own failure message states the stake correctly -- "Without the sidecar the
leg has no remote cache client at all, so it cannot exhibit the HIT XOS-05 is
measured on: the leg goes green having proved nothing" -- but a running sidecar
is not what gives Nx a remote cache client. The `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`
and `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` values, written to `$GITHUB_ENV`
by the "Pre-set the Nx cache client vars for the sidecar" step
(`ci.yml:449-456`, `499-506`, `549-556`), are.

Delete that step from any of the three legs and:

- all seven clauses for that leg stay green (nothing anywhere reads it),
- `ci.yml`'s own comment already concedes there is no other guard: "This is an
  unguarded invariant: nothing fails if it drifts" (`ci.yml:309-310`),
- Nx runs with LOCAL cache only, MISSes on a fresh runner, executes the target,
  and the job goes GREEN,
- and XOS-05's O4 observation becomes unobtainable with the whole suite green.

The readiness poll has the same standing: without it the Nx step can start before
the sidecar binds, every request fails, best-effort read degradation kicks in, and
the leg is green having cached nothing.

The gap matters more here than on the ubuntu producers, because the Windows legs
exist for NOTHING BUT the HIT observation. A producer that silently loses its
cache client still builds; a consumer that silently loses its cache client is a
deleted control that still looks present.

**Fix:** Extend `windowsLegReasons` with a `cacheClient` reason and add one case
per leg:

```ts
it('pre-sets the Nx remote cache client vars, without which the sidecar is inert', () => {
  const block = jobBlock('build-windows');

  expect(block, cacheClient).toMatch(
    /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http:\/\/127\.0\.0\.1:3000" >> "\$GITHUB_ENV"$/m,
  );
  expect(block, cacheClient).toMatch(
    /^\s+echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=\$\{token\}" >> "\$GITHUB_ENV"$/m,
  );
  // The readiness poll: without it the Nx step can beat the sidecar to the port
  // and the leg goes green having cached nothing.
  expect(block, cacheClient).toMatch(/^ {6}- name: Wait for the loopback sidecar$/m);
});
```

### WR-07: "`windows-11-arm` occurs 19 times in `ci.yml` today" is stale, and was measured against the wrong artifact

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:569-571, 592-594`
**Severity:** WARNING

**Issue:** The XOS-04 block header states, and `windowsLegReasons.runsOn`
repeats to every future reader of a failure message:

> `windows-11-arm` occurs 19 times in `ci.yml` today, so a whole-file
> `toContain('windows-11-arm')` passes unconditionally whatever these three jobs
> actually say.

Measured at HEAD with a positive control in the identical command shape:

| Reading | Count |
| --- | --- |
| raw `ci.yml`, HEAD | 25 |
| raw `ci.yml`, `0251bd3` (pre-phase) | 19 |
| comment-stripped `ci.yml`, HEAD | 10 |
| comment-stripped `ci.yml`, `0251bd3` | 7 |

Two defects, not one. The 19 was measured before this phase's own `ci.yml` edit
landed and was never re-measured -- guards authored RED, number frozen at author
time. And 19 was never the RELEVANT number: `codeLines` strips every `#` line
(`dogfood-cross-os.spec.ts:49-54`), so the count that supports the vacuity
argument is the comment-stripped one, which was 7 then and is 10 now.

The vacuity ARGUMENT is sound at any of these numbers. The number is not, and
this file's own house standard is "MEASURED, not predicted".

**Fix:** State the number the guard actually reads, and say which artifact it
was measured against:

```
 * AND EVERY CLAUSE IS SCOPED TO `jobBlock(<leg>)`, never to the file.
 * `windows-11-arm` occurs 10 times in the COMMENT-STRIPPED `ci.yml` this guard
 * reads (25 times in the raw file), so a whole-file `toContain('windows-11-arm')`
 * passes unconditionally whatever these three jobs actually say.
```

Mirror the correction in the `runsOn` message. Re-measure both when `ci.yml`
changes shape again.

### WR-08: `compare.ts` still argues that `ci.yml` cannot be pinned from a spec -- false since Phase 9, and now contradicted twice over

**File:** `packages/github-cache/src/hash-parity/compare.ts:173-177`
**Severity:** WARNING

**Issue:** `fail`'s doc-comment closes with:

> Neither half suffices alone. The anchor cannot be pinned from a spec --
> `ci.yml` is not a declared `test` input (PARITY-08, deferred to Phase 9), so a
> spec asserting on its content would serve a stale cached PASS. This half is the
> pinnable half, and `compare.spec.ts` pins it.

Both halves are false at HEAD:

- `{workspaceRoot}/.github/workflows/ci.yml` IS a declared `test` input
  (`nx.json:70`), and `nx-target-inputs.spec.ts:655-659` pins it.
- The anchor CAN be pinned from a spec, and IS -- `dogfood-cross-os.spec.ts:449`
  pins the sibling job's `grep -q '^o3-witness: EXISTENCE OK'` expression by
  exactly this mechanism.

This is not neutral rot. As written, it is a standing argument that the
`hash-parity-compare` job's `^hash-parity: PARITY OK` anchor -- one half of a
two-half injection defence the same comment calls load-bearing -- is UNGUARDABLE,
which is a documented reason not to guard it.

The phase edited this file's module doc-comment (the `--no-warnings` re-spelling)
and corrected the IDENTICAL stale claim in two `ci.yml` comment blocks and in
`nx-target-inputs.spec.ts`. This site was missed.

**Fix:** Supply the replacement fact rather than deleting the sentence, matching
the correction shape used in `ci.yml:1180-1196`:

```ts
 * IT IS HALF THE FIX, and says so. ... Neither half suffices alone.
 *
 * CORRECTED (Phase 12). This block used to say the anchor "cannot be pinned from
 * a spec" because `ci.yml` was not a declared `test` input. Both halves are now
 * false: `{workspaceRoot}/.github/workflows/ci.yml` IS a `test` input
 * (`nx.json:70`, PARITY-08, Phase 9), and `dogfood-cross-os.spec.ts` pins the
 * sibling `o3-witness` grep anchor by that exact mechanism. So the
 * `hash-parity-compare` anchor is PINNABLE and simply is not pinned yet -- an
 * open gap, not an impossibility. Do not read the old wording as a reason to
 * leave it unguarded.
```

### WR-09: Three new cache producers landed without extending `publish`'s `needs:`, so the XOS-07 guard's stated invariant is now literally false

**File:** `.github/workflows/ci.yml:1726`, `packages/github-cache/src/dogfood-cross-os.spec.ts:153-161`
**Severity:** WARNING

**Issue:** `ci.yml:415-417` records, in this phase's own words, that the edge
"does NOT remove the SECOND PRODUCER: from these jobs onward a windows-11-arm
runner writes build/typecheck/test entries too".

`publish` still declares `needs: [build, typecheck, test, integration]`. The
guard that protects that list is titled:

> `describe('ci.yml publish waits on every job that produces a mirrored entry (XOS-07)')`

and its shared `reason` states the mechanism: "A leg reads the Actions-cache key
set ONCE at its publish step start and never re-reads it, so what it can mirror
is a function of its START TIME". By its own rule, three producers are now
missing from the list. `publish` can and will start while `build-windows`,
`typecheck-windows` and `test-windows` are still running.

Scope honestly: on the HAPPY path the Windows legs compute the SAME hash as their
ubuntu producers, so they HIT and write no NEW key -- nothing is missed. The gap
opens only when a Windows hash diverges (a MISS, execute, save a NEW key), which
is the regression case the milestone exists to catch, and the cost is a mirror
entry deferred to the next push, never a wrong artifact. That bounds the
severity, but it does not make the guard title true.

Either outcome is acceptable; leaving both the list and the title as they are is
not, because the title now reads as coverage the list does not provide.

**Fix (pick one, in the same commit as the decision):**

Option A -- extend the list and add the three cases to the existing describe:

```yaml
    needs:
      [
        build,
        typecheck,
        test,
        integration,
        build-windows,
        typecheck-windows,
        test-windows,
      ]
```

Option B -- keep the list and narrow the title plus the reason:

```ts
describe('ci.yml publish waits on every job that produces a NEW mirrored key (XOS-07)', () => {
  const reason =
    'The publish job must declare needs: [build, typecheck, test, integration]. ' +
    'The three windows-* legs (XOS-04) are deliberately ABSENT: they compute the ' +
    'SAME task hash as their ubuntu producer, so on the happy path they HIT and ' +
    'write no NEW key. A Windows leg that MISSED would write one publish could ' +
    'race -- accepted, because the cost is a mirror entry deferred to the next ' +
    'push and the divergence itself is already gated by hash-parity-compare. ' +
    ...
```

## Info

### IN-01: `windows-regression-detector.yml` says ci.yml has "nineteen" jobs; it has 21

**File:** `.github/workflows/windows-regression-detector.yml:4-7`
**Issue:** "adding a schedule trigger to ci.yml would fire all nineteen of its
jobs on a calendar cadence". `ci.yml` declares 21 job keys at HEAD (18 before
this phase, +3 from XOS-04). The ARGUMENT is correct; only the count is wrong,
and it was wrong on the day the file was authored.
**Fix:** Drop the number -- "would fire every one of its jobs" carries the point
and cannot rot -- or restate it as 21.

### IN-02: The `nx.json` cross-os pin comment claims an alphabetical ordering that does not exist

**File:** `packages/github-cache/src/nx-target-inputs.spec.ts:769-773`
**Issue:** "this one is placed immediately after `docs/configuration.md` so the
`docs/` run stays alphabetical". The run at `nx.json:62-66` is
`configuration, cross-os, advanced, trust-and-security, versioning` -- not
alphabetical, and it was not alphabetical before the insertion either
(`configuration, advanced, ...`).
**Fix:** State the real convention (`placed immediately after
docs/configuration.md, beside the other docs/ entries`) or reorder the six
entries alphabetically and keep the claim.

### IN-03: "It renders values that live in configuration" describes a mechanism the doc does not have

**File:** `docs/cross-os.md:3-9`
**Issue:** The opening paragraph reads "It renders values that live in
configuration, never a re-typed paraphrase: the platform discriminator below is
read out of this repository's own `nx.json`". Nothing renders and nothing is
read at build time -- `cross-os.md` is a static file containing a hand-typed
byte-identical copy, and a test asserts the copy matches. A maintainer taking
"renders" literally would look for a generator that does not exist.
**Fix:** "It PINS values that live in configuration: the platform discriminator
below is a byte-identical copy of this repository's own `nx.json`, and the
`docs-cross-os` guard reads the declared value out of `nx.json` and fails the
build if the copy drifts."

### IN-04: The checklist-count clause computes against a garbage slice when the heading is absent

**File:** `packages/github-cache/src/docs-cross-os.spec.ts:190-201`
**Issue:** `doc.indexOf(CHECKLIST_HEADING)` returns `-1` when the heading is
reworded, so `doc.slice(-1 + CHECKLIST_HEADING.length)` slices from an arbitrary
offset and the item count is computed over unrelated text. The `>= 0` control for
that heading lives in a DIFFERENT `it` (line 152-154), so this case reports a
count mismatch rather than the missing heading. The file's own header states the
opposite standard for the `existsSync` guard: "a NAMED assertion failure rather
than a module-load crash that says nothing about which claim was lost."
**Fix:** Guard in-clause before slicing:

```ts
const checklistAt = doc.indexOf(CHECKLIST_HEADING);

expect(
  checklistAt,
  `docs/cross-os.md is missing the checklist heading \`${CHECKLIST_HEADING}\`, so the item count below would be computed over unrelated text. ${REWORD_ADVICE}`,
).toBeGreaterThanOrEqual(0);

const afterHeading = doc.slice(checklistAt + CHECKLIST_HEADING.length);
```

### IN-05: The `docs/advanced.md` nav clause is satisfied by a bare mention

**File:** `packages/github-cache/src/docs-cross-os.spec.ts:212-217`
**Issue:** `expect(read('docs/advanced.md')).toContain('cross-os.md')` passes on
any occurrence of the substring -- a prose mention, an HTML comment, or a
crossed-out reference. Its own failure message names a placement the assertion
does not check ("The cross-link sits in the publish / sync section"). Its README
sibling one clause above uses the stronger link-shaped
`/^- \[.+\]\(docs\/cross-os\.md\) -- /m`.
**Fix:** Assert a markdown link: `.toMatch(/\[[^\]]+\]\(cross-os\.md\)/)`.

### IN-06: `dogfood-cross-os.spec.ts`'s ROBUST-04 block counts sidecar sites that this phase changed

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:215-217, 244-245`
**Issue:** Pre-existing text (unchanged by this phase) reads "the committed
`start-cache-server/index.js` that four of the five sidecar `uses:` sites run".
This phase added three `uses: ./start-cache-server` sites, taking the real
counts to 8 `./start-cache-server` sites and 4 `./packages/github-cache` sites
(12 total). The ROBUST-04 argument -- that the dogfood jobs build the action
in-job and therefore never sample the committed bundle -- is unaffected and still
correct; only the arithmetic is stale, and it is stale BECAUSE of this phase's
edit.
**Fix:** Re-measure and restate ("eight of the twelve sidecar `uses:` sites run
the committed bundle; the four `./packages/github-cache` sites build it in-job"),
or drop the count in favour of the qualitative statement.

---

_Reviewed: 2026-07-30T21:20:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
