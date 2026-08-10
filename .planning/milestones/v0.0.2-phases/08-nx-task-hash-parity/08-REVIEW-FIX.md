---
phase: 08-nx-task-hash-parity
fixed_at: 2026-07-28T16:05:00Z
review_path: .planning/phases/08-nx-task-hash-parity/08-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Source review:** `.planning/phases/08-nx-task-hash-parity/08-REVIEW.md`
**Iteration:** 1
**Scope:** Critical + Warning (0 Critical, 5 Warning). Info deliberately out of scope.

**Summary:**

- Findings in scope: 5
- Fixed: 5
- Skipped: 0

One of the five (WR-02) was closed by the review's OWN stated alternative rather
than its primary suggestion, and the reasoning is recorded in full below and in
the repo. Nothing was skipped and nothing was left unrecorded.

## Fixed Issues

### WR-01: the "prove the comparison ran" grep is forgeable from record content

**Files modified:** `packages/github-cache/src/hash-parity/compare.ts`,
`packages/github-cache/src/hash-parity/compare.spec.ts`,
`.github/workflows/ci.yml`
**Commit:** `81067e2`

**Applied fix.** The review named two changes; both are load-bearing, and I
measured the full truth table on the BUILT bin with a crafted record pair before
accepting either:

| state | `grep -q 'PARITY OK'` | `grep -q '^PARITY OK'` |
|---|---|---|
| pre-fix | MATCH (forged) | MATCH (forged -- the injected LF starts a line) |
| code fix only | MATCH (forged -- mid-line substring) | -- |
| code fix + anchor | no match | no match |
| valid pair (control) | MATCH | MATCH, bin exit 0 |

So the reviewer's judgement that "anchoring alone does not fix it" is correct,
and the converse is equally true: **escaping alone does not fix it either**,
because the payload still matches as a mid-line substring of the failure line.
The two halves are jointly necessary. The green path is unbroken -- a valid pair
still prints a line the anchored pattern matches, verified.

**One deliberate departure from the suggested fix.** The review prescribed
`JSON.stringify(name)` at `compare.ts:172`. Escaping per interpolation site would
have left the hole open, because `name` is not the only record-controlled value
reaching a detail: `meta.os` and the hashes do too, at five further sites the
review did not enumerate. I confirmed `meta.os` is an independently exploitable
vector. So the newline neutralisation went into ONE choke point -- a new `fail()`
helper every refusal returns through -- which covers those sites and every detail
string written later. The suggested `JSON.stringify` was ALSO applied to the
target key, because it keeps the offending key readable rather than collapsed to
a space.

**RED observed, per mutation, and the spec comment records exactly this rather
than a tidier symmetry it does not have:**

- collapse disabled -> the `meta.os` vector reddens; the target-key vector stays
  green (the quoting already handles it)
- quoting reverted -> both vectors stay green on the one-line assertion; the
  DIAGNOSTIC test reddens on
  `record 0: \`targets. hash-parity: PARITY OK\` is not an object`

The ci.yml anchor is not pinnable from a spec (ci.yml is not a declared `test`
input until PARITY-08), so its rationale block now carries the composite claim
and warns against removing either half. It also drops the old wording that called
the grep independent without qualification -- until both halves landed it was
not, and the block now says why.

### WR-02: `typecheck.outputs` overlaps `build.outputs` on 63 of its 136 files

**Files modified:** `packages/github-cache/src/nx-target-inputs.spec.ts`,
`.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`
**Commit:** `fbb1403`
**Disposition:** nx.json change DECLINED; the documentation gap FIXED. This is
the review's own second option: "If the seven-entry list must stay verbatim to
match plugin inference (a defensible reading of the existing rationale), then at
minimum extend the spec comment to record the overlap and why it is accepted."

**Re-measured rather than taken on the review's word**, and every figure
reproduces: `build.outputs` resolves to
`["{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
"{projectRoot}/dist/tsconfig.lib.tsbuildinfo"]`; the overlap is 31 + 31 + 1 = 63
of 136; and the on-disk `dist/tsconfig.lib.tsbuildinfo` records
`emitDeclarationOnly: false` beside 31 emitted `.js` files, confirming the two
targets write it with contradictory options and that `typecheck`'s restore lands
last.

**Why the nx.json edit is declined -- three reasons, the first decisive:**

1. **`build.outputs` is PLUGIN-INFERRED.** `nx.json` declares no
   `targetDefaults.build.outputs`, so the overlap is `@nx/js/typescript`'s own
   inference on BOTH targets, not something the `typecheck` override introduced.
   Keeping the seven verbatim REPRODUCES the plugin; dropping one makes the pin
   diverge from it, which is exactly what the recorded rationale says the
   verbatim list exists to prevent. This reframes the finding: it is an upstream
   design property, not a local mistake.
2. **It would not fix the stated cost.** Dropping only the buildinfo leaves 62 of
   the 63 files still shared, so the duplication -- the expensive half, mirrored
   to a public Release by the `publish` job -- is untouched.
3. **It would make the list incomplete.** `typecheck` would declare 135 of the
   136 files it writes: an output the target produces and does not cache, the
   exact incompleteness the 136/136 enumeration was run to rule out.

Recorded in both places the phase's conventions require: the D-13 rationale lock
in `nx-target-inputs.spec.ts` (where `nx.json`'s reasoning lives, since `nx.json`
holds no comments), and `08-ROOT-CAUSE.md` as a LABELLED CORRECTION with its
measurement rather than a silent edit. The `### The VALUE that entry must carry`
section gained a forward pointer so a reader arriving there is not misled by its
silence. The real fix is filed as an accepted residual for the same possible
upstream report as the OS-dependent project-reference classification.

**`nx.json` was not touched, so `163e6b9` remains the only `nx.json` fix commit
in Phase 8 and 08-04's ordering proof is undisturbed** --
`git log --oneline 7bfe64f..HEAD -- nx.json` still returns the same three commits
the record names.

### WR-03: the seven `REQUIRED_META_KEYS` are never compared across the two records

**Files modified:** `packages/github-cache/src/hash-parity/compare.ts`,
`packages/github-cache/src/hash-parity/compare.spec.ts`,
`.github/workflows/ci.yml`
**Commit:** `71c42ff`

**Applied fix.** Implemented, as the brief preferred. A new `not-like-for-like`
clause compares `commit`, `nxVersion` and `arch` across the pair, placed beside
`duplicate-platform` and before clause (a) so a skewed pair cannot reach clause
(c) and report `invariant-target-diverged` -- the wrong-blame class
`duplicate-platform` exists to eliminate, one field over.

**Scoped to the three keys the review named, with the four exclusions recorded at
the constant rather than left as an unexplained asymmetry.** `nodeVersion`
specifically must NOT be required equal: the record measured it inert
(observation points 1 and 3 differ ONLY in Node version and are byte-identical
with zero differing nodes), so requiring it would reject the
workstation-against-runner comparison the whole record is built on.
`installMode` and `graphState` are D-09 admissibility conditions that both CI
legs satisfy by construction; enforcing them would make the record's deliberate
cross-state readings inexpressible.

**RED observed under two DISTINCT mutations, which is the point:**

- loop made vacuous -> the negative reddens, the over-reach control stays green
- list widened to include `nodeVersion` -> the over-reach control AND the content
  pin redden

That second mutation is why the over-reach control exists. Widening the list is
the obvious "improvement" to this clause and it would silently break the record's
own comparison; the control makes that a red test rather than a discovery.

**Second half of the finding: the ci.yml "CHECKABLE" claim.** Corrected rather
than implemented, because it genuinely cannot be implemented where it was
claimed. The block asserted that `meta.commit` vs `meta.githubSha` makes the
checkout pin checkable; that check was both unimplemented AND stated backwards --
`GITHUB_SHA` on a `pull_request` IS the merge commit, so AGREEMENT is the pin
FAILING, which `08-ROOT-CAUSE.md:623-649` already established and the workflow
comment never absorbed. The comparator cannot perform it: the correct direction
is event-dependent and it has no event context, and `githubSha` is null off a
runner. The block now states the direction correctly and names what does check
it -- the record's one-off API cross-check, plus this commit's cross-leg
`meta.commit` clause, which catches the failure the pin actually produces.

### WR-04: `discriminator.stdout` / `stderr` are required present, then never read

**Files modified:** `packages/github-cache/src/hash-parity/compare.ts`,
`packages/github-cache/src/hash-parity/compare.spec.ts`
**Commit:** `ebdb76a`

**Applied fix.** Implemented the assertion rather than taking the review's
alternative of deleting the fields. A new
`discriminator-not-platform-sensitive` clause fails a pair whose two
`discriminator.stdout` values are identical -- the state the module header argues
is impossible, and which no existing clause could catch: (b) sees hashes that DO
differ, and (c) cannot see `integration` at all because CORR-04 excludes it from
the invariant set.

Placed AFTER clause (b) as the review specified, and that placement is now
pinned: identical streams AND identical hashes is a discriminator that is simply
gone, which is (b)'s named reason and the better blame.

**`stderr` stays shape-checked and uncompared, and the code now says why** rather
than leaving it as the same finding in different clothing: it is legitimately
EMPTY on every healthy leg, so an equality check is vacuous and an inequality
check would assert that a healthy run writes to stderr. Its presence is still
required because `hash_runtime` hashes both streams.

**Three mutations, three observed REDs, one per new assertion:**

- clause disabled -> the negative reddens
- clause moved before clause (b) -> the ordering control reddens (it also caught
  the detail no longer naming `integration`)
- `stderr` also compared -> the stderr over-reach control reddens

### WR-05: `pack-check.cjs` calls `process.exit()` immediately after writing

**Files modified:** `packages/github-cache/pack-check.cjs`
**Commit:** `4c0f8ad`

**Applied fix.** Adopted `assert-parity.ts`'s pattern -- `process.exitCode = 1`
plus `return`, and no `process.exit(0)` -- so the enumerated `LEAK:` / `MISSING:`
list cannot be discarded on the POSIX pipe the runner captures step output
through.

**Verified rather than assumed, because an unproven `exitCode` assignment would
be a guard that goes green FOREVER -- strictly worse than the truncation it
replaces.** With output redirected: success path exit 0 with the message intact;
failure path exit 1 with both injected problems AND the full trailing paragraph
present. The failure path was forced by temporarily adding a bogus `REQUIRED`
entry and a `README.md` leak predicate, then reverted.

## Declined sub-items, and Info findings

**Nothing was skipped.** Two sub-items inside otherwise-fixed findings were
declined on stated grounds, both recorded in the code:

- **WR-02's `nx.json` edit** -- declined, three reasons above, and the review's
  own sanctioned alternative taken instead.
- **WR-04's suggested "discriminator stdout must match meta.os" check** -- not
  added. It was listed by the reviewer as an observation, not a prescribed fix,
  and it would couple the comparator to the discriminator command's exact
  spelling, which is the D-14 coupling this module deliberately avoids. The
  chosen clause proves the discriminator DISCRIMINATED without asserting what it
  printed.

**Info findings (IN-01..IN-08) are out of scope and none was naturally closed.**
Two live in files I touched but on lines I did not: IN-04's missing `!== null`
guards in `nx-target-inputs.spec.ts` (I edited only its comment block) and
IN-05's `.env` predicate in `pack-check.cjs` (I edited only the exit path). Both
remain open for a follow-up.

**The reviewer's explicit clearances were respected.** `compare.ts:shapeFault`
was not refactored -- the new code adds clauses beside it and quotes three of its
template strings, changing no control flow. The `capture-hashes.mjs` and
`pack-check.cjs` CRAP numbers were not touched.

## Verification

Full battery in the main working tree, all nine exit 0:

```
format:check       exit 0      test               exit 0
build              exit 0      lint               exit 0
typecheck          exit 0      fallow:ci          exit 0
typecheck:action   exit 0      check:action       exit 0
                               pack:check         exit 0
```

Comparator spec: 37 tests passing (was 28; +9 across the four code findings).
All six touched files are pure ASCII. Working tree clean. Committer identity is
the public address on all five commits, and an allowlist-inversion scan over the
whole new diff plus every commit message finds zero email-shaped tokens.

**One note on `check:action`.** It failed inside the isolated worktree this work
was done in, and the failure was an artefact, not drift: the worktree shared the
main tree's `node_modules` through a junction, so esbuild recorded resolved paths
as `../github-cache/node_modules/...`. Verified as an artefact rather than
assumed -- all 689 changed bundle lines differ ONLY by that prefix, zero for any
other reason -- and the bundle was restored untouched. It exits 0 in the main
tree, which is the authoritative run. None of the changed files is
`serve()`-reachable, so no bundle regeneration was owed.

## What a CI round trip would add

Not pushed, and PR #9 untouched, per instruction. Nothing here strictly requires
CI, but two items are worth the orchestrator's judgement:

1. **WR-05's POSIX flush behaviour is the one thing this workstation cannot
   observe.** The truncation hazard is POSIX-pipe-specific; Windows streams are
   synchronous, so the local verification confirms the exit code and full message
   but not the flush itself. The change is strictly safer than the prior
   `process.exit()` either way, so this is corroboration rather than a gap.
2. **All five task hashes will rotate on the next run**, because `compare.ts`,
   `compare.spec.ts`, `nx-target-inputs.spec.ts` and `pack-check.cjs` are all
   declared `{projectRoot}` inputs. This is the pre-recorded legitimate
   rotation window the record names under "this phase's fix commits are a
   LEGITIMATE all-MISS rotation window" -- not a defect, and no tripwire should
   fire on it.

The gate's own behaviour did not have to wait for CI: the forged-record
experiment ran against the real built bin and the real log bytes the workflow
step greps, which is what let the anchor be proven load-bearing despite being
unpinnable from a spec.

---

_Fixed: 2026-07-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
