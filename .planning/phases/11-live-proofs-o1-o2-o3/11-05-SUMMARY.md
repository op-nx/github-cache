---
phase: 11-live-proofs-o1-o2-o3
plan: 05
subsystem: test-guards
tags: [red-half, content-guard, ci-yml, o3-witness, phrase-lock]
requires:
  - '11-04 sign-off authorising the spec-edit hash rotation'
  - 'nx.json:69 registering .github/workflows/ci.yml as a test input (PARITY-08)'
provides:
  - 'dogfood-cross-os.spec.ts describe: ci.yml o3-witness job exists and keeps its shape (XOS-03, TEST-09)'
  - 'docs-same-os-claims.spec.ts: five additive DOCS_08_SITES rows keyed on .github/workflows/ci.yml'
  - 'ten exact phrase literals for plan 11-06 to write character for character'
affects:
  - '11-06 (the GREEN half; must write these literals verbatim)'
  - '11-07 (XOS-03 / TEST-09 close there, not here)'
tech-stack:
  added: []
  patterns:
    - 'jobBlock() throw as the anti-silent-deletion presence mechanism'
    - 'positive-control-first inside every describe'
    - 'indent-anchored regex with the m flag, never an unanchored token'
    - 'additive DOCS_08_SITES row with forbidden: [] as a load-bearing empty'
key-files:
  created: []
  modified:
    - packages/github-cache/src/dogfood-cross-os.spec.ts
    - packages/github-cache/src/docs-same-os-claims.spec.ts
decisions:
  - 'D-19 is TWO spec edits, not one: presence and shape to the comment-stripped reader, comment prose to the raw reader'
  - "Row C pins the RECORDED-never-GATED reason and the margin measurement separately; the not-a-guarantee clause is required in the prose but NOT pinned, because the literal already exists in ci.yml's publish block"
  - 'EDITED_FILES left unchanged, with the scope reasoning recorded in the spec header rather than only here'
metrics:
  duration: 15m
  completed: 2026-07-29
status: complete
---

# Phase 11 Plan 05: RED content guards for the O3 `ci.yml` work -- Summary

Authored 17 deliberately failing assertions across two spec files -- seven pinning the
`o3-witness` job's presence and shape where `jobBlock()` throws on an absent job key, and ten
pinning the new `ci.yml` rationale prose phrase by phrase in the only guard in the repo that
can see a comment. **HEAD is deliberately RED at the end of this plan**, which is the recorded
shape from plan 10-03. Plan 11-06 is the single GREEN commit.

## What was built

| Task | Commit | File | Assertions |
|---|---|---|---|
| 1 | `345ce56` | `packages/github-cache/src/dogfood-cross-os.spec.ts` | 7 `it()` in one new describe |
| 2 | `932a13b` | `packages/github-cache/src/docs-same-os-claims.spec.ts` | 5 rows x 2 phrases = 10 `it()` |

`jobBlock` is still defined in `dogfood-cross-os.spec.ts`, still unexported, and was NOT moved
to a shared module: the guard came to the helper, per that file's own recorded reasoning.

## Observed RED -- not predicted, measured

Pre-registered counts were 7 after task 1 and 17 after task 2, with 0 pre-existing failures.
Baseline before any edit: **823 passed, 0 failed** across 39 test files.

| After | Observed Vitest summary | Pre-registered | Match |
|---|---|---|---|
| task 1 | `Tests  7 failed \| 823 passed (830)` | 7 | exact |
| task 2 | `Tests  17 failed \| 823 passed (840)` | 17 | exact |

The 823 passing count is identical at all three points, so nothing pre-existing broke and no
new failure came from anywhere but the new assertions.

### The RED is ASSERTION-level, and here is the evidence rather than the claim

**Task 1 -- the presence guard.** All seven failures carry the `jobBlock` throw, and the
message names the missing job:

```
FAIL src/dogfood-cross-os.spec.ts > ci.yml o3-witness job exists and keeps its shape (XOS-03, TEST-09) > scopes to a real o3-witness job block that waits on integration
Error: ci.yml: no job keyed `  o3-witness:` -- VER-06's guard cannot scope its assertions
```

Two independent facts make this assertion-level rather than import-level:

1. `Test Files  1 failed | 38 passed (39)` -- and the failing file's **three other describe
   blocks all passed**. The module loaded, `readFileSync` on `ci.yml` succeeded, and
   `jobBlock('publish')`, `jobBlock('dogfood-seed')`, `jobBlock('dogfood-verify')` and
   `jobBlock('action-bundle-drift')` all resolved. Only the `o3-witness` key is absent.
2. `npm exec nx typecheck github-cache` is GREEN, so nothing is unresolvable at the type level.

**Task 2 -- the phrase locks.** The failure prints the file's real content in the received
value, which is only possible if the file was read:

```
AssertionError: .github/workflows/ci.yml no longer contains the exact phrase
`ci.yml IS in nx.json's test inputs (nx.json:69, PARITY-08, Phase 9)`. ...
: expected 'name: CI\n\non:\n  push:\n    branche...' to contain 'ci.yml IS in nx.json\'s test inputs (...'

- Expected
+ Received

- ci.yml IS in nx.json's test inputs (nx.json:69, PARITY-08, Phase 9)
+ name: CI
+
+ on:
```

A guard that threw on an unreadable file would go green the moment `ci.yml` gained any content
at all. This one is false against a `ci.yml` that is fully readable and simply lacks the job
and the prose.

## The ten phrase literals plan 11-06 must write CHARACTER FOR CHARACTER

Every one was verified ABSENT from the current `ci.yml` by a `String.prototype.includes` scan
over the raw file, with a **positive control** on the search: the known-present literal
`A measurement is not a documented guarantee` reported PRESENT in the same run, so the ten
ABSENT verdicts are a reading and not a false zero.

| Row | # | Exact literal | Len | In current ci.yml |
|---|---|---|---|---|
| A | 1 | `ci.yml IS in nx.json's test inputs (nx.json:69, PARITY-08, Phase 9)` | 67 | ABSENT |
| A | 2 | `asserted by dogfood-cross-os.spec.ts and docs-same-os-claims.spec.ts` | 68 | ABSENT |
| B | 1 | `o3-witness restates contents: read because a job-level block REPLACES` | 69 | ABSENT |
| B | 2 | `o3-witness does NOT request actions: write, the cache DELETE verb` | 65 | ABSENT |
| C | 1 | `RECORDED and never GATED: a zero count is CORRECT on the windows leg` | 68 | ABSENT |
| C | 2 | `MEASURED ubuntu-first 11 of 11 runs, 182 s max on run 30471772954` | 65 | ABSENT |
| D | 1 | `the acceptance set is 200 ALONE -- a 404 here is a control FAILURE` | 66 | ABSENT |
| D | 2 | `the readiness poll accepts 404 or 200 on purpose; do not collapse them` | 70 | ABSENT |
| E | 1 | `?key= is a PREFIX match, so total_count > 0 is NOT an existence test` | 68 | ABSENT |
| E | 2 | `the witness compares .key for EXACT string equality, never a count` | 66 | ABSENT |

Placement per plan 11-06: row D goes beside the positive-control step in the `integration`
job (task 1); rows B, C and E go in the `o3-witness` job's own comment block and row A into
the two corrected `hash-parity` / `hash-parity-compare` blocks (task 2).

### The one-line check, mechanically

**Longest phrase: 70 characters.** `ci.yml`'s existing comment lines already run to **97**
characters (median 82), measured over all 792 comment lines in the file. The prefix cost by
indent level is 4 characters for a job-level comment (`  # `), 8 for a step-level comment
(`      # `) and 12 for a nested continuation (`          # `). So the worst case is 70 + 12 =
**82 characters**, exactly the file's median line and 15 under its maximum. Every phrase fits
on one line at every indent level this phase uses, with room for surrounding words.

This matters because `read()` is a raw file read and the assertion is `toContain`: a phrase
spanning a hard wrap would have to embed the `# ` continuation prefix, so it would match
NOTHING and the row would be a **silent false PASS in the additive direction**.

### Two uniqueness traps that were hit and steered around

1. **Row B.** The generic wholesale-replacement sentence already sits above the `publish` job
   (`A job-level permissions block REPLACES the workflow grant ... it does NOT merge`). A
   phrase reusing that wording would pass from the pre-existing occurrence and lock nothing.
   Both row B phrases are therefore keyed on `o3-witness` **by name**.
2. **Row C's measurement.** The house form for a measurement is the value, the run id, and the
   clause that a measurement is not a documented guarantee. Two of those three literals are
   already in `ci.yml`: `A measurement is not a documented guarantee` (the publish block) and
   `run 30401077417` (already a locked phrase in the XOS-06 row of this same table). So row C
   pins `run 30471772954` -- the max-margin run, 182 s -- instead. **The
   not-a-guarantee clause is still REQUIRED in the prose 11-06 writes; it is simply not
   pinnable here**, and that is recorded in the row's own JSDoc so a reader does not read the
   omission as an oversight.

Also avoided: row D's phrase says `accepts 404 or 200 on purpose` rather than reusing
`wanted 404 or 200`, which already appears in the readiness step's failure message.

## `EDITED_FILES` left unchanged, and why that is not the same-commit rule being skipped

`.github/workflows/ci.yml` is already in `EDITED_FILES`. The two instruments this phase adds
-- `read-integration-hash.mjs` and `capture-hashes.mjs`'s new mode -- are workspace-ROOT dev
instruments, and `capture-hashes.mjs` is edited by this milestone while likewise absent from
the list. So the established scope of `EDITED_FILES` is docs, `ci.yml` and files under
`packages/github-cache/src/`, and that scope holds unchanged. The reasoning is also recorded
in the spec file's own header, not only here, so the in-tree reader finds it without this
SUMMARY.

## Hash rotation: the prediction held exactly

Measured from `.nx/cache/run.json` after both commits, via one
`nx run-many -t build,typecheck,test,integration`.

| Target | Pre-rotation baseline (O1/O2) | Post-edit observed | Rotated |
|---|---|---|---|
| `build` | `17269409342684722256` | `17269409342684722256` | **NO -- byte-identical** |
| `test` | `11681410932071446589` | `188679580032851371` | YES |
| `integration` | `8137422034373911537` | `4283357908429349587` | YES |
| `typecheck` | `122473981802582055` | `14220792214246320661` | YES |

`build` did not rotate, which is the prediction that mattered: `nx.json:116` excludes
`!{projectRoot}/src/**/*.spec.ts` from the `build` inputs, and `build` reported
`local-cache-hit` at the same hash it had before the edits. The input model is what the phase
believes it is. Three of the four proof targets died, exactly as D-10 says and exactly as plan
11-04's gate authorised.

**Do not attempt any local cross-OS cache measurement from here on in this phase.** The mirror
holds the pre-rotation hashes, so a MISS is now the expected outcome and would prove nothing
about cross-OS sharing.

## Local battery

| Check | Result | How it was asserted |
|---|---|---|
| `nx test github-cache` | RED, 17 failed / 823 passed | intended; the whole point of this plan |
| `nx typecheck github-cache` | GREEN | asserted on the printed `Successfully ran target` line |
| `nx lint github-cache` | GREEN | asserted on the printed `Successfully ran target` line |
| `nx format:check` | GREEN | after `npm run format` on both files |
| `.github/workflows/ci.yml` | UNCHANGED | `git status --short .github/` printed nothing at every step |
| `start-cache-server/` | UNCHANGED | same, so no bundle drift is possible |

`typecheck` and `lint` were asserted on the PRINTED line rather than on the exit code alone,
per this repo's recorded trap that a missing Nx target exits 0. A first attempt matching the
full literal `Successfully ran target typecheck for project @op-nx/github-cache` returned zero
because Nx wraps the target name in ANSI bold; that is a tooling artefact of the check, not a
finding, and the ANSI-tolerant pattern confirmed both targets green.

`npm run check:action` was deliberately NOT run: spec files are not reachable from `serve()`,
so the committed bundle cannot drift from these edits.

## Deviations from Plan

None of substance. Two shapes chosen inside the latitude the plan gave, both recorded in-tree:

**1. The `contents: read` and `actions: read` patterns are not `$`-terminated.** The plan says
to terminate with `$` "where the value is the whole line". A trailing `#` rationale comment on
either permission line is legitimate YAML and is what RESEARCH.md's own snippet shows, so
those two patterns are `/^ {6}contents: read\b/m` and `/^ {6}actions: read\b/m`. The `^` plus
the explicit six-space count -- the load-bearing half -- is intact, and the reason is in a
comment beside the two cases. The other five patterns are `$`-terminated.

**2. Row C's not-a-guarantee clause is required-in-prose but not pinned.** See the uniqueness
trap above. Pinning it would have produced a row that passes from a pre-existing occurrence in
the publish block, which is the exact failure row B's job-keying avoids.

## Requirements

XOS-03, TEST-09 and TEST-08 all stay **Pending**. XOS-03 and TEST-09 close at plan 11-07;
TEST-08 is Phase 12. Nothing was flipped.

## Threat Flags

None. Both files are test-only and introduce no network endpoint, auth path, file access
pattern or schema change. T-11-18 through T-11-21 are all mitigated as planned: the
`jobBlock` throw makes deletion loud, every phrase is verified one-line and absent, `nx.json:69`
keeps the guards out of a stale cached PASS, and every new row is additive with `forbidden: []`
so no absence check can be satisfied by deleting a whole comment.

## What plan 11-06 inherits

1. Ten literals to write character for character, in the table above.
2. Seven shape requirements: `needs: integration` (four-space, whole line),
   `permissions:` (four-space), `contents: read` and `actions: read` (six-space),
   `runs-on: ubuntu-24.04-arm` (four-space, whole line), `timeout-minutes: <digits>`
   (four-space, whole line), and `if: ${{ !cancelled() }}` (four-space, whole line).
3. A pre-registered green count: 15 failing after its task 1, 0 after its task 2. A count
   BELOW 15 after task 1 means a phrase matched pre-existing text and that row must be
   re-chosen.
4. The two stale comment blocks still uncorrected, and row A's two phrases are what will prove
   the correction supplied a replacement fact rather than merely deleting the wrong one.

## TDD Gate Compliance

`workflow.tdd_mode` is true and both tasks carried `tdd="true"`. **The RED gate is satisfied
and the GREEN gate is deliberately ABSENT from this plan** -- it is not a missing commit, it is
the next plan. Recorded here so the end-of-phase `tdd.review-checkpoint` does not read the
absence as a skipped gate.

| Gate | Commit | Status |
|---|---|---|
| RED (task 1) | `345ce56` `test(11-05): assert the o3-witness job's presence and shape (RED)` | present |
| RED (task 2) | `932a13b` `test(11-05): lock the new ci.yml rationale prose, five additive rows (RED)` | present |
| GREEN | plan **11-06**, `.github/workflows/ci.yml` | by design, next plan |
| REFACTOR | n/a | no behaviour to clean up; these are assertions |

The RED->GREEN pair spans two plans on purpose, and the plan's objective says so in as many
words: creating the `o3-witness` job here would collapse the pair and destroy the RED evidence.
Both RED commits carry a `test(11-05):` subject so the checkpoint can find them. No test passed
unexpectedly during RED -- all 17 failed, and the two counts matched their pre-registered
values exactly, which is the fail-fast condition discharged rather than skipped.

## Self-Check: PASSED

Both modified spec files exist on disk; both commits `345ce56` and `932a13b` are reachable in
`git log --all`; `.github/workflows/ci.yml` and `start-cache-server/` are byte-identical to
their pre-plan state; no file was deleted by either commit and no untracked file was left
behind.
