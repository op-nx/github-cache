---
phase: 12-windows-ci-reuse-o4-consumer-recipe
fixed_at: 2026-07-31T00:05:00Z
review_path: .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 16
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-07-31T00:05:00Z
**Source review:** `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 16 (CR-01, WR-01..WR-09, IN-01..IN-06 -- `fix_scope: all`)
- Fixed: 16
- Skipped: 0

**Verification after the final commit:** `test` 42 files / 899 tests passing (up
from 896 -- WR-06 added three), `typecheck` clean, `lint` clean, `build` clean,
`nx format:check` clean. `start-cache-server/index.js` is byte-identical to
`5e0a741` (no bundle regeneration was due; see the bundle-reachability note under
WR-08).

**Files touched across all 16 commits:**

| File | Findings |
| --- | --- |
| `docs/cross-os.md` | CR-01, WR-01, WR-02, WR-03, WR-04, IN-03 |
| `packages/github-cache/src/docs-cross-os.spec.ts` | CR-01, IN-04, IN-05 |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` | WR-06, WR-07, WR-09, IN-06 |
| `packages/github-cache/src/windows-regression-detector.spec.ts` | WR-05 |
| `packages/github-cache/src/hash-parity/compare.ts` | WR-08 |
| `packages/github-cache/src/nx-target-inputs.spec.ts` | IN-02 |
| `.github/workflows/windows-regression-detector.yml` | IN-01 |

`.github/workflows/ci.yml` was **not** modified -- see WR-09.

## Fixed Issues

### CR-01: section 1's only copy-pasteable snippet was the EXCEPTION

**Files modified:** `docs/cross-os.md`, `packages/github-cache/src/docs-cross-os.spec.ts`
**Commit:** `2f9f567`
**Status:** fixed

The snippet under "declare the discriminator on every cacheable target" now shows
the MAXIMUM -- `build`, `test` and `lint`, each with a `"...your <target>
inputs..."` placeholder -- so the artifact under the heading demonstrates the
heading. This repository's `integration`-only end state is kept as clearly
labelled prose, naming why it is the END of section 2 rather than a starting
point, and naming what a consumer who pastes it actually gets. Dropping the
`"default"` / `"^production"` leads also closes consequence 3: `"^production"` has
no Nx built-in fallback, so the old block was a hash-time error in a workspace
that defines no `production` namedInput.

`RENDERED_DISCRIMINATOR_SITES` raised 2 -> 4 in the same commit, per that
constant's own instruction. **MEASURED, not predicted:** counted with the guard's
own `doc.split(command).length - 1` shape against the literal read out of
`nx.json`, with a known-once needle returning 1 and a known-absent needle
returning 0 as positive controls in the identical shape. The constant's comment
now records that a count of 2 specifically means the snippet collapsed back to one
target, so the number carries its own diagnosis.

The guard's other clauses were re-checked against the rewritten section rather
than assumed: the ordering clause (both headings unchanged, order unchanged), the
"no numbered section precedes the safe default" clause (no numbered headings
added), and the five-item checklist count (untouched).

### WR-01: the replacement warning never named the consequence or the recovery

**Files modified:** `docs/cross-os.md`
**Commit:** `f46a005`
**Status:** fixed

"ADDING A LINE" replaced with "REPRODUCING THE WHOLE LIST and then appending the
discriminator". The consequence is now named -- an incomplete replacement
under-hashes, and under-hashing serves a HIT on a stale entry, a WRONG RESULT of
the same class as the missing discriminator -- and the recovery procedure
(`nx show project <project> --json | jq '.targets["<target>"].inputs'`) is given
so the reader can read the inferred list before destroying it.

**Deviation from the review's fix text, and why:** the review's issue narrative
cited a "25-entry" explicit `test` list. Re-measured at HEAD:
`nx.json`'s `targetDefaults.test.inputs` holds **28**. Rather than correct 25 to
28, the doc states the qualitative fact and no number at all -- planting a fresh
unguarded count in a doc is the same defect class WR-07, IN-01 and IN-06 exist to
close.

### WR-02: the cross-OS recipe omitted the line-ending prerequisite

**Files modified:** `docs/cross-os.md`
**Commit:** `8758f0c`
**Status:** fixed

Section 4 named Nx's stream trimming as the hazard you do NOT have to handle, then
stopped -- steering the reader away from suspecting line endings in the DEFAULT
case. The section now names the one the reader does have to handle, as a
prerequisite: GitHub's Windows runners default to `core.autocrlf=true`, Nx hashes
file CONTENTS, so without a `.gitattributes` every file-based input diverges and
cross-OS hits go to zero silently. The mitigation given is the exact line this
repository already ships and comments (verified against `.gitattributes`).

### WR-03: the libc gap was attributed to arm64, and the axis swap had no bar

**Files modified:** `docs/cross-os.md`
**Commit:** `38d8483`
**Status:** fixed

Both halves fixed. The reasons are split into their own paragraph -- architecture
is unexercised because every machine here is arm64; libc is unexercised because
both Linux environments are glibc and glibc-versus-musl varies freely WITHIN one
architecture -- and the axis swap now restates the bar (non-empty token, EMPTY
stderr with the PID-warning failure mode named, a value that genuinely differs on
the axis varied), plus the concrete musl trap
(`process.report.getReport().header.glibcVersionRuntime` is absent on musl and
yields `undefined`, which prints and hashes).

**Constraint the review flagged but did not resolve:** the D-13 guard requires
`architecture`, `libc` and `arm64` in ONE sentence
(`/architecture[^.!?]{0,80}libc[^.!?]{0,80}arm64/i`), which is the shape that
invited attaching one reason to two axes. Applying the review's fix text verbatim
would have reddened that guard. The lead sentence therefore keeps all three tokens
in that order -- "It does not cover CPU architecture and it does not cover libc,
and arm64-everywhere explains only the first" -- which satisfies the guard while
saying the opposite of what the old sentence said. Verified: the guard's own regex
still matches, with a negative control in the identical shape returning null.

### WR-04: "Nx's two cache-directory environment variables" was a completeness claim

**Files modified:** `docs/cross-os.md`
**Commit:** `1c33db9`
**Status:** fixed

Checklist item 5 now scopes the claim to the two variables that govern Nx's GRAPH
and plugin-inference state, says those are what a HASH measurement depends on, and
names `NX_CACHE_DIRECTORY` for the case the reader is measuring HITS -- closing the
path where a local task-cache hit is attributed to the remote tier. The checklist
still has exactly five numbered items, which `docs-cross-os.spec.ts` counts.

### WR-05: the detector's clauses could not tell a gating grep from a decorative one

**Files modified:** `packages/github-cache/src/windows-regression-detector.spec.ts`
**Commit:** `98c8613`
**Status:** fixed

Both bare `toContain` calls replaced with pinned expressions, matching the repo's
own stronger precedent one file over (`dogfood-cross-os.spec.ts`'s `o3-witness`
anchor). **Mutation-measured before committing**, all three mutations the finding
names:

| Mutation | Old assertions | New assertions |
| --- | --- | --- |
| `grep -q '...' detector.log` -> `grep '...' detector.log \|\| true` | green | **red** |
| needle moved into an `echo` banner, grep deleted | green | **red** |
| `--skip-nx-cache` migrated onto another command | green | **red** |

The `$` terminator is what specifically rejects the `|| true` form -- the review's
own proposed regex `grep -q '<needle>' \S+\.log` still matches it, because the
`|| true` falls outside the match. That is noted in the clause's comment so the
terminator is not dropped as noise. The cache-bypass clause pins one contiguous
line carrying the three targets AND the flag; the literal contains no regex
metacharacter, so it can only match on one line.

### WR-06: the sidecar clause did not guard the thing that makes the leg a consumer

**Files modified:** `packages/github-cache/src/dogfood-cross-os.spec.ts`
**Commit:** `15e898d`
**Status:** fixed

`windowsLegReasons` gains a `cacheClient` reason, and each of the three legs gains
a case pinning the two `NX_SELF_HOSTED_REMOTE_CACHE_*` writes to `$GITHUB_ENV` and
the readiness poll step. Separate from the sidecar clause rather than folded into
it, because the two fail for different reasons.

**Mutation-measured against all three leg blocks before committing:** deleting the
whole "Pre-set the Nx cache client vars for the sidecar" step leaves all seven
pre-existing clauses for that leg GREEN (including `- uses: ./start-cache-server`
and `- cancel: cache-server`) while Nx runs local-cache-only, MISSes on a fresh
runner, executes the target, and the job passes. Deleting the readiness poll has
the same standing. All three new regexes go red on their own mutation and on no
other. This is the invariant `ci.yml`'s own comment described as "an unguarded
invariant: nothing fails if it drifts" -- it is now guarded.

### WR-07: the "19 times" count was stale and measured against the wrong artifact

**Files modified:** `packages/github-cache/src/dogfood-cross-os.spec.ts`
**Commit:** `4797311`
**Status:** fixed

Both sites -- the XOS-04 block header and `windowsLegReasons.runsOn` -- now state
the comment-stripped count first (the reading the guard actually performs), give
the raw count in parentheses, name which artifact each is measured against, and
carry an instruction to re-measure BOTH when `ci.yml` next changes shape. The
header also records why the old number was wrong in two independent ways
(frozen at author time on RED guards; raw when the guard strips comments), so the
correction is not re-derivable as an oversight.

**RE-MEASURED at HEAD through the guard's own strip**, with a known-once needle
returning 1 and a known-absent needle returning 0 as controls in the identical
shape:

| Reading | Count |
| --- | --- |
| raw `ci.yml`, HEAD | 25 |
| raw `ci.yml`, `0251bd3` | 19 |
| comment-stripped, HEAD | 10 |
| comment-stripped, `0251bd3` | 7 |

All four confirm the review's table independently.

### WR-08: `compare.ts` still argued that `ci.yml` cannot be pinned from a spec

**Files modified:** `packages/github-cache/src/hash-parity/compare.ts`
**Commit:** `8ae902a`
**Status:** fixed

Corrected with the replacement fact supplied rather than the sentence deleted,
matching the shape `ci.yml` already uses. Both stale halves were **re-verified
rather than taken from the review**: `{workspaceRoot}/.github/workflows/ci.yml` is
in `nx.json`'s `test` inputs and `nx-target-inputs.spec.ts` pins it by name; and
`dogfood-cross-os.spec.ts` pins the sibling `o3-witness` job's
`grep -q '^o3-witness: EXISTENCE OK'` expression by exactly the mechanism the old
comment called impossible. The `hash-parity-compare` anchor is now recorded as an
OPEN GAP rather than an impossibility, with an explicit instruction not to read
the old wording as a reason to leave it unguarded.

**Bundle-drift check:** `compare.ts` is not reachable from the committed
`start-cache-server/index.js` -- verified by searching the committed bundle for
three distinctive `compare.ts` symbols (genuine no-match, exit 1) against a
positive control that returns 3 hits, and by confirming the esbuild entry point is
`start-cache-server/entry.ts`. No bundle regeneration was due, and `git diff`
against `5e0a741` confirms the bundle is byte-identical.

### WR-09: three new producers landed without extending `publish`'s `needs:`

**Files modified:** `packages/github-cache/src/dogfood-cross-os.spec.ts`
**Commit:** `19d4fa5`
**Status:** fixed -- **Option B chosen**

**Decision: Option B** (keep the `needs:` list, narrow the guard title and reason).
`ci.yml` is unmodified. Rationale, since the review left the choice open:

1. **Option A was tried and measured first, not reasoned about.** At seven members
   prettier reformats `needs:` into a multi-line flow sequence -- exactly the shape
   the review's Option A snippet shows. That strands all four existing clauses,
   each anchored `^ {4}needs:.*\b<name>\b`, against a now-bare `needs:` line.
   Measured: **4 failed / 895 passed**. Option A therefore costs a seven-clause
   re-anchoring on top of the CI topology change. It also breaks the existing
   `\btest\b` pattern, which would newly be satisfied by `test-windows`.
2. **The three legs are non-producers BY DESIGN.** They carry no platform
   discriminator, so each computes the SAME task hash as its ubuntu producer and
   HITs. `integration` is in the list for the inverse reason: its runtime
   discriminator makes the Windows leg's hash genuinely distinct, so that leg is
   the only producer of those entries. That is a principled distinction, not an
   accident, and Option B is what states it.
3. **The case Option A would cover is one the milestone wants to CATCH.** A
   diverged Windows hash is already gated by `hash-parity-compare` and the
   scheduled detector; its cost is one mirror entry deferred to the next push,
   never a wrong artifact.

**Cost accepted and recorded in the file:** the title rename rots six coverage refs
in `10-03-SUMMARY.md` and `10-05-SUMMARY.md`, which is the exact trade this block
previously recorded as a reason NOT to rename. The reversal and a pointer for
anyone following a rotted ref are written into the block: the old trade was right
when the gain was cosmetic (adding XOS-06 to the title), and flips when the
alternative is leaving a false invariant standing. Verified that nothing resolves
those refs mechanically -- no spec reads `.planning`, and `.planning` is not an
`nx.json` `test` input, so no automated check breaks.

### IN-01: the detector header said ci.yml has "nineteen" jobs

**Files modified:** `.github/workflows/windows-regression-detector.yml`
**Commit:** `7868d97`
**Status:** fixed

**RE-MEASURED** by counting job keys under `jobs:`: **21 at HEAD, 18 at
`0251bd3`** -- so the number was wrong on the day the file was authored and wrong
again three jobs later. Of the review's two options the count is DROPPED rather
than restated as 21: the argument never depended on it, "every one of its jobs"
carries the point and cannot rot. Both measurements are recorded inline so the
next reader does not reconstruct a count.

### IN-02: the `nx.json` pin comment claimed a non-existent alphabetical ordering

**Files modified:** `packages/github-cache/src/nx-target-inputs.spec.ts`
**Commit:** `25281c9`
**Status:** fixed

**MEASURED out of `nx.json`:** the `docs/` run is configuration, cross-os,
advanced, trust-and-security, versioning, examples/minimal-ci.yml,
examples/README.md -- seven entries, one contiguous run, not alphabetical, and not
alphabetical before the insertion either. Of the review's two options, stating the
real convention beats reordering: adjacency is the invariant that earns its keep
(a missing entry is visible by reading one block), whereas alphabetical order buys
nothing and reordering churns a `test` input for a cosmetic property. The comment
now says why, so a reader "restoring" the claimed convention does not move five
entries for no gain.

### IN-03: "renders values that live in configuration" describes a mechanism that does not exist

**Files modified:** `docs/cross-os.md`
**Commit:** `a523e9d`
**Status:** fixed

Reworded to PINS, describing the mechanism the document actually has: a
byte-identical hand-typed copy, with `docs-cross-os.spec.ts` reading the declared
value out of `nx.json` and failing the build on drift. The paragraph now says
outright that nothing is generated at build time, so a maintainer does not go
looking for a renderer.

### IN-04: the checklist-count clause computed against a garbage slice

**Files modified:** `packages/github-cache/src/docs-cross-os.spec.ts`
**Commit:** `1e6f8a8`
**Status:** fixed

The heading index is now asserted `>= 0` in-clause, with a message naming the
heading, before anything slices on it -- so a reworded heading reports the MISSING
HEADING rather than a count mismatch computed over unrelated text. This restores
the standard the file's own header states for the `existsSync` guard.

### IN-05: the `docs/advanced.md` nav clause was satisfied by a bare mention

**Files modified:** `packages/github-cache/src/docs-cross-os.spec.ts`
**Commit:** `75eb093`
**Status:** fixed

Now asserts a markdown link, matching its README sibling. **Mutation-measured
against the three realistic drift modes:** a prose mention, an HTML comment, and a
bare filename in a code span all satisfied the old containment and all are rejected
by the link regex. One residual is named in the comment rather than left to be
discovered -- a live link wrapped in `~~` strikethrough still matches, and closing
it would cost a lookbehind for one exotic edit. The failure message also named a
PLACEMENT the assertion never checked; that is now stated as the convention it is,
explicitly flagged as not asserted.

### IN-06: the ROBUST-04 block counted sidecar sites this phase changed

**Files modified:** `packages/github-cache/src/dogfood-cross-os.spec.ts`
**Commit:** `84eac4d`
**Status:** fixed

Both sites (block comment and the `if:` clause's failure message) restated. The
load-bearing statement is now the RULE, which cannot rot: every
`- uses: ./start-cache-server` site runs the COMMITTED bundle, every
`- uses: ./packages/github-cache` site builds it from source in-job, and both
dogfood jobs take the second path.

**RE-MEASURED** through the guard's own comment strip, with a `uses:` line known
present returning 20 and a fabricated one returning 0 as controls:

| Point | `./start-cache-server` | `./packages/github-cache` | Total |
| --- | --- | --- | --- |
| HEAD | 8 | 4 | 12 |
| `0251bd3` | 5 | 4 | 9 |

Counts kept as dated context with a re-measure instruction, matching the shape
WR-07 established in this same sweep. The ROBUST-04 argument never depended on
either number and was never wrong -- only the arithmetic was.

## Skipped Issues

None. All 16 in-scope findings were applied, verified and committed.

## Cross-cutting notes

**Every number written in this sweep was re-measured against the finished tree in
a final pass, not against the review's text.** One review figure did not survive
re-measurement (WR-01's "25-entry" `test` list is 28 at HEAD) and was handled by
dropping the count rather than correcting it. All other review measurements were
independently reproduced.

**Three findings (WR-07, IN-01, IN-06) were the same defect: an unguarded count in
a comment.** Where the count was load-bearing it is now stated with its artifact
and a re-measure instruction (WR-07, IN-06); where it was decorative it was dropped
in favour of a claim that cannot rot (IN-01, and WR-01's added prose). That split
is recorded in each commit message so the pattern is legible.

**Two findings needed a decision the review left open or could not see:** WR-09's
Option A/B (measured, then chosen -- Option B), and WR-03's collision with the D-13
guard's own one-sentence requirement (resolved by keeping the three tokens in the
lead sentence while inverting its claim). Both are documented in the source, not
only here.

**Human verification suggested for WR-09.** It is the only finding whose fix
encodes a judgement about CI topology rather than a fact: the decision to leave
`publish`'s `needs:` list narrow accepts a bounded gap (a diverged Windows hash's
new key is mirrored on the next push rather than this one). The reasoning and the
measured cost of the alternative are in the commit and in the source comment, but
the trade itself is a call worth a maintainer's confirmation.

---

_Fixed: 2026-07-31T00:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
