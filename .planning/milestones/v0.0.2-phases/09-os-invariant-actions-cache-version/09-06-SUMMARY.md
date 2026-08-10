---
phase: 09-os-invariant-actions-cache-version
plan: 06
subsystem: observability-docs
status: complete
tags:
  - obs-04
  - docs-08
  - rotation-signal
  - phrase-keyed-guard
  - requirement-miscount-lock
requires:
  - 09-01 # {workspaceRoot}/.github/workflows/ci.yml as a `test` input (nx.json:69) -- without it the two ci.yml rows replay a stale cached PASS
  - 09-02 # 09-ROTATION-SIGNAL.md, whose axis wording the reworded message must match
  - 09-03 # CACHE_ARCHIVE_DIR + enableCrossOsArchive -- the change that made the same-OS claims false
  - 09-05 # the dogfood-verify two-leg matrix and its single-leg dogfood-seed drift guard, neither contradicted
provides:
  - DOCS_08_SITES # six rows keyed on FILE + QUOTED PHRASE, carrying the four-vs-six miscount lock and the ci.yml line-number drift record
  - docs-same-os-claims.spec.ts # the DOCS-08 site guard plus the OBS-03 retraction assertion
  - the reworded all-restore-MISS warning # names the @actions/cache cache VERSION axis, both causes, and the two-push gate
affects:
  - packages/github-cache/src/publish/publish-mirror.ts
  - docs/advanced.md
  - README.md
  - docs/trust-and-security.md
  - .github/workflows/ci.yml
tech-stack:
  added: [] # no new npm package, no new action, no new script
  patterns:
    - A8 # site-list constant keyed on FILE + QUOTED PHRASE, carrying a requirement miscount
    - single-character-character-class # an absence claim that never spells the token it forbids
    - per-row-describe-loop # each site is its own named test, so a failure names the site
key-files:
  created:
    - packages/github-cache/src/docs-same-os-claims.spec.ts
  modified:
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
    - docs/advanced.md
    - README.md
    - docs/trust-and-security.md
    - .github/workflows/ci.yml
decisions:
  - The guard's home is a new src/docs-same-os-claims.spec.ts -- neither existing docs guard reads ci.yml, and two of the six rows key on it
  - Site 2's replacement supplies a NEW two-legged reason in the same sentence as `keep BOTH legs`, so the corrected text does not argue for collapsing the matrix
  - The reworded message avoids the token `differen` entirely, so the acceptance criterion's `git grep -c "differen"` reads cleanly as zero
metrics:
  duration: ~50 min
  completed: 2026-07-28
  tasks: 3
  commits: 1
  tests_before: 640 across 36 files
  tests_after: 663 across 37 files
requirements: [OBS-04, DOCS-08]
---

# Phase 09 Plan 06: Correct the Same-OS Claims and Reword the Warning Summary

Every place this repo asserted same-OS restore now says what is true, the two `ci.yml`
comments that justified a two-leg matrix still justify it for a NEW reason, and six
phrase-keyed rows fail by name if any of them drifts back.

## What Was Built

`enableCrossOsArchive: true` plus a workspace-relative path literal (plan 09-03) inverted a
claim this repo asserted in four places as a load-bearing invariant. Two of those four were
comments justifying a two-leg matrix, and one was the justification the `keep BOTH legs`
instruction rests on -- so correcting the text without replacing the reason would have left a
later reader with a documented argument for collapsing the matrix that plan 09-05 built one
wave earlier.

**1. The reworded warning.** `publish-mirror.ts`'s all-restore-MISS `core.warning` drops
"Expected when publishing from a different OS than the entries were saved on" -- which from
this phase forward is not merely unhelpful but the wrong diagnosis, and was the FIRST thing a
reader saw. It now names the **axis**: the `@actions/cache` cache VERSION, explicitly a
SEPARATE mechanism from the Nx TASK hash and from the Release ASSET NAME, since all three
produce a look-alike all-MISS through unrelated machinery (D-30 forbids a tripwire that fires
on the other two). It names both candidate causes -- a cache-version rotation in this commit
range (the archive path literal or the cross-OS flag changed), and the runtime token's
Actions-cache read scope -- and carries the gate verbatim: expected ONCE per version-affecting
change, with two consecutive all-miss pushes and no version-affecting change in between as the
signal to act. It stays a `core.warning`; no `setFailed` or throw was added to this branch.
The comment block above it now points at `09-ROTATION-SIGNAL.md` as the recorded-in-advance
expectation, and names the bundle-drift signal that looks identical but is a defect.

The axis wording matches `09-ROTATION-SIGNAL.md`'s "The axis, and why naming it matters"
section word for word: `@actions/cache cache VERSION`, `Nx TASK hash`, `Release ASSET NAME`.
Two copies of one diagnosis that cannot drift without a test failing.

**2. Six documentation edits, three corrections and three additive preconditions.**

| # | Site | Bucket | What changed |
|---|---|---|---|
| 1 | `docs/advanced.md` publish/sync paragraph | CORRECTION | the whole reasoning chain -- the same-OS premise, the only-tasks-that-ran-here consequence, and the asset-count-asymmetry consequence -- plus OBS-04's consumer-facing half |
| 2 | `ci.yml` publish-matrix comment | CORRECTION | the per-OS-path and `windows-only`-salt clauses inverted; the compression-method clause kept (still true, pushed unconditionally); a NEW two-legged reason supplied |
| 3 | `ci.yml` `integration` comment, TWO sentences | CORRECTION, NARROW | 3a: the attribution made exclusive (the Nx hash is now the ONLY separation). 3b: only the trailing CORR-01-namespacing clause replaced |
| 4 | `docs/advanced.md` fault-degradation line | ADDITIVE (D-32) | existing sentence retained verbatim, precondition added |
| 5 | `README.md` "Correct over clever" | ADDITIVE | existing sentence retained verbatim, precondition added |
| 6 | `docs/trust-and-security.md` fault-degradation line | ADDITIVE | existing sentence retained verbatim, precondition added |

Site 3 was corrected narrowly, per the named anti-pattern. "a Linux cache never satisfies a
Windows run" and "the two legs compute DIFFERENT Nx task hashes" are both still TRUE and both
stay; only the attribution changed (from storage to the Nx hash) and only the trailing false
clause was replaced. XOS-03's point -- that the divergence is a statement about Nx HASHES and
not about cache storage, and that a storage-level probe for the Linux key from a Windows runner
would now HIT -- is stated in 3b's replacement.

The three additive sites each keep their fault-degradation sentence byte-for-byte and gain a
platform-agnosticism precondition: the guarantee is about read FAULTS, and it assumes a cached
task's outputs do not depend on which OS produced them -- the store no longer partitions by
runner OS, so a task whose output genuinely differs per OS must declare that difference as an
Nx input, with this repo's `integration` target named as the instance. No contradiction, and
no trace of the retracted whose-bytes claim.

**3. `DOCS_08_SITES`, keyed on phrases.** Six rows, each with a `file` (workspace-root-relative,
read via `readFileSync(new URL(file, WORKSPACE_ROOT_URL), 'utf8')`), a `required` array of exact
post-edit phrases, a `bucket`, a per-row `/** ... */` note naming what owns the row, and -- for
the three correction rows -- a `forbidden` regex written with single-character character classes
so the spec never spells the phrases it forbids. The loop is
`for (const row of DOCS_08_SITES) { describe(...) }`, so each site is its own named test.
Both failure messages carry the maintenance instruction in `lineIndexOf`'s register: this table
is keyed on FILE + PHRASE on purpose, and a legitimately reworded site means updating its ROW in
the same commit.

A separate `it.each` over the four edited files proves the retracted producer-attribution claim
(`/whose byte[s]/i`) appears in none of them, using the same character-class technique.

## The two-leg justification, replaced rather than deleted

This was the subtlest requirement and the easiest to half-do, so it is recorded explicitly.
Both corrected `ci.yml` comments previously rested the two-leg matrix on storage partitioning.
Both now rest it on the Nx hash instead:

- **Site 2** (the one the `keep BOTH legs` instruction depends on): "The reason to keep both
  legs is now the Nx HASH, not the store: the Windows leg is still the ONLY leg that produces
  Windows-hash entries at all, because the integration and hash-parity platform discriminator
  keeps those task hashes distinct. So collapsing this to one OS STILL SILENTLY drops the other
  OS's entries (D-03) -- now because those tasks never RUN there, rather than because the store
  partitions -- keep BOTH legs". The new reason sits in the same sentence chain as the
  instruction, and `DOCS_08_SITES` requires the phrase
  `the ONLY leg that produces Windows-hash entries` alongside `keep BOTH legs`, so deleting the
  replacement reason while keeping the instruction fails the guard.
- **Site 1** (`docs/advanced.md`): "Two legs are still worth running, for a different reason:
  each leg is still the only place its own OS's tasks **run**". Also guard-required.

Nothing contradicts plan 09-05: `dogfood-seed` stays single-leg and `dogfood-verify` stays
two-leg, both byte-unchanged, and 09-05's drift guard
(`dogfood-cross-os.spec.ts`, including the `dogfood-seed` single-leg assertion) is green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `as const` dropped `forbidden` from the additive rows' union members**

- **Found during:** Task 3's battery, at `npm run typecheck` -- NOT at `npm run test`.
- **Issue:** `TS2339: Property 'forbidden' does not exist on type '{...} | ... 4 more ... | {...}'`
  at `docs-same-os-claims.spec.ts:160`. With `as const`, the three additive rows that omitted
  `forbidden` produced union members lacking the property, so destructuring it in the loop did
  not compile. Vitest transpiles without typechecking, so all 663 tests passed green while the
  file did not typecheck -- the test run was not the type gate here.
- **Fix:** gave the three additive rows an explicit `forbidden: []` with a comment recording why
  it is empty-rather-than-absent, and simplified the loop from `forbidden ?? []` to `forbidden`.
  An additive row forbids nothing by definition, so the empty array is semantically honest.
- **Files modified:** `packages/github-cache/src/docs-same-os-claims.spec.ts`
- **Commit:** `474c1b5`

**2. [Rule 1 - Bug] site 2's false premise appeared twice in one comment block, not once**

- **Found during:** Task 2 STEP 2
- **Issue:** the plan keys site 2 on the `@actions/cache folds the per-OS tmpdir path...` clause,
  but the SAME false premise appears two lines above it in the same comment: "restores the
  nx-cache-* ones **IT CAN restore on ITS OWN OS**". Correcting only the keyed clause would have
  left a false statement two lines above a corrected one, in the same block.
- **Fix:** corrected both. D-31's own range for this site is `ci.yml:943-950`, the whole comment
  block, so this is inside the site as the decision record scopes it -- RESEARCH Q10 narrowed the
  quoted key to two lines, not the site.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** `474c1b5`

### Plan Inaccuracies Corrected (not code changes)

Recorded so plan 09-07 and the verifier do not re-derive them.

| Plan claim | Measured reality |
|---|---|
| Task 1 acceptance: `git grep -c "differen" -- publish-mirror.ts` shows the explanation is gone | The instrument is wrong in the same way plan 09-05 recorded: `git grep -c` counts LINES containing the string, so any legitimate use of "different"/"DIFFERENT" in the reworded message or comment would have made the count non-zero and read as a failure. Sidestepped rather than reinterpreted: the reword avoids the token entirely (using SEPARATE/distinct), so the command now genuinely returns no match (exit 1) and the criterion reads cleanly. Intent was verified independently by searching for the actual phrase. |
| Threat T-09-45 cites "PATTERNS anti-pattern 10" as naming the matrix-justification coupling | Anti-pattern 10 is *"Over-correcting DOCS-08 site 3"*. The matrix-justification coupling is named in RESEARCH Q10's closing paragraph on site 2 and in the plan's own `key_links`, not in anti-pattern 10. Both constraints were honoured; only the citation is off. |
| Site 2 quoted phrase spans "...so an ubuntu leg can NEVER restore a" | Accurate, and the clause continues "Windows-saved entry (restoreCache returns undefined and the engine skips it)" on the next line, which was replaced with it. |
| RESEARCH Q10: `ci.yml:1059` is the `publish-verify` own-OS-asset comment | Now at **`ci.yml:1104`** (`publish-verify:` at `:1112`). Untouched, as required -- confirmed it sits past this plan's last hunk. |
| Site locations at HEAD | `docs/advanced.md:54` (site 1), `ci.yml:982` (site 2), `ci.yml:387` and `:407` (site 3a/3b), `docs/advanced.md:45` (4), `README.md:124` (5), `docs/trust-and-security.md:184` (6). All located by phrase; RESEARCH Q10's numbers were accurate except site 2 (`:982`, not `:947`) and site 3b (`:407`, not `:406`). |

## TDD Gate Compliance

**There is no separate `test(09-06): ...` RED commit, and that is deliberate -- flagged rather
than left for the gate scanner to discover.**

The plan imposes a one-commit constraint explicitly: Task 1 STEP 3 ends "Do NOT commit yet --
Task 3 creates this plan's commit, so the docs and the message land together with the guard that
pins them", Task 2 STEP 6 ends "Do not commit yet", and Task 3's acceptance criterion is "Exactly
ONE commit contains the seven paths". The plan is authoritative on commit structure, and its
reason is substantive: `DOCS_08_SITES`' required phrases assert text that only exists after the
six doc edits, so a RED-only commit would be a commit where `npm run test` fails -- and the
guard exists precisely to pin the edits it ships with.

This is the same call plan 09-05 made and recorded, for the same class of reason (C-03: the guard
and its accommodation are ONE commit).

The gate's SUBSTANCE was satisfied: RED was observed before the work was accepted, three times,
and recorded below.

### RED was ASSERTION-LEVEL in all three cases, not an import failure

Every failure below was a named test failing on its own merits with the suite running to
completion (662 passing alongside the 1 failure), so none is a whole-file import error
masquerading as RED.

**Task 1 STEP 3 -- the absence assertion, proven able to fail.** The removed clause was
temporarily re-added to the message.

- **1 test RED:** `no longer offers the storage-partitioning explanation this milestone made false (OBS-04, D-27)`
  - Verbatim: `AssertionError: expected "vi.fn()" to be called with arguments: [ StringNotMatching /differen[t] OS/ ]`
  - The diff output showed the full offending message, so the failure is diagnosable.
- **The three `restored as a MISS` anchors stayed GREEN**, which is the point: they prove the
  branch is REACHED and would keep passing against a message that had lost everything a reader
  needs. Content assertions are what catch a silent revert.
- Reverted; 663 green reconfirmed.

**Task 2 STEP 6 M1 -- a required-phrase row.** Site 5's added sentence was reverted in the
working tree.

- **1 test RED**, naming the site:
  `docs-same-os-claims.spec.ts > ... > README.md -- additive: Every read fault degrades to a cache MISS (a rebuild), > still contains 'must declare that difference as an Nx input'`
- The failure carried the maintenance instruction verbatim: *"This table is keyed on FILE +
  PHRASE on purpose -- these six edits shift each other's lines in one commit, so a line number
  would rot. If the site was legitimately reworded, update its ROW here in the SAME commit; do
  not delete the assertion to make the suite green."*
- **The other five rows stayed GREEN.** Restored.

**Task 2 STEP 6 M2 -- a forbidden-pattern row.** Site 3b's false clause was re-added.

- **1 test RED**, naming both the site and the pattern:
  `.github/workflows/ci.yml -- correction: that Nx hash is the ONLY thing separating them > no longer asserts same-OS restore (/exactly the CORR-01 namespacin[g] the store/)`
- Message: *"`.github/workflows/ci.yml` has drifted BACK to a same-OS-restore claim matching
  /exactly the CORR-01 namespacin[g] the store/. VER-01 made the archive path OS-invariant and
  VER-03 set enableCrossOsArchive, so the claim is false."*
- Reverted; 663 green reconfirmed. `git status` clean before the commit -- no mutated state
  persisted.

## Open Items

### `human_needed` -- OBS-04's rotation-signal reading (merge-gated, NOT closed here)

**This plan closes the message and the docs. It does NOT close the live observation, and no
acceptance criterion in it can.** `ci.yml:3-7` filters pushes to `main` and the `publish` job is
`if: ${{ !cancelled() && github.event_name == 'push' }}` (`ci.yml:994`), so nothing on this
branch and nothing on a pull request can produce the signal. No pre-merge-satisfiable check was
authored for it, and no assertion was weakened to make one pass locally.

- **Where it will be read:** the FIRST push to `main` after this branch merges, in that run's
  `publish` job summary, on BOTH matrix legs (`ubuntu-24.04-arm` and `windows-11-arm`).
- **What it is checked against:** `09-ROTATION-SIGNAL.md` (committed in wave 1 at `e7018d0`), the
  prediction recorded IN ADVANCE of plan 09-03's version-rotating commit. Its predicted per-leg
  counts, in `writeCountSummary`'s verbatim row labels: `scanned > 0`, `mirrored == 0`,
  `skipped == scanned`, `restore-MISS (of skipped) == scanned`, `failed == 0`, plus exactly one
  `core.warning` containing `restored as a MISS` per leg.
- **It exists on exactly ONE run and cannot be re-sampled** -- the next push is a normal all-HIT
  push. A `scanned == 0` run does not satisfy it either: the warning's branch requires
  `hashes.length > 0`, so a zero-scan run means the prediction was never sampled and the one
  opportunity is gone.
- **Carried into:** plan 09-07's `09-EVIDENCE.md` `## Live-CI closures` section.
- **The one misreading to guard against:** a `serve()`-reachable edit reaching `main` WITHOUT the
  rebuilt `start-cache-server/index.js` makes the five `ci.yml` sidecar sites write at the OLD
  cache version while the publish action restores at the NEW one -- surfacing as exactly this
  all-MISS warning, on a run where it is a DEFECT. The reading rule from
  `09-ROTATION-SIGNAL.md`: an all-MISS is this event only if plan 09-03's commit is in the range
  AND `action-bundle-drift` was green on the merge. If that job is or was red, the all-MISS is
  the drift, not the rotation.

## Verification

All NINE battery commands exit 0 at the committed tree (`474c1b5`):

| Command | Result |
|---|---|
| `npm run format:check` | pass |
| `npm run build` | pass |
| `npm run typecheck` | pass |
| `npm run typecheck:action` | pass |
| `npm run test` | 663 passed, 37 files |
| `npm run lint` | pass |
| `npm run fallow:ci` | `No issues found`, 56 entry points |
| `npm run check:action` | pass, **EMPTY diff** |
| `npm run pack:check` | pass, 55 files, no internals leaked |

**`check:action` was VERIFIED, not assumed.** `publish-mirror.ts` is not `serve()`-reachable
(the bundle's single entry is `start-cache-server/entry.ts`), so `start-cache-server/index.js` is
unmodified and is NOT among the commit's seven paths -- confirmed by
`git status --short -- start-cache-server/index.js` returning nothing after `build:action` ran.
`npm ci` was used rather than a junctioned `node_modules`, so the esbuild path-rewrite artefact
measured in plan 09-01 does not apply and the empty diff is meaningful.

Test count moved 640/36 files -> 663/37 files: +1 file (`docs-same-os-claims.spec.ts`, 21 tests
-- 14 required-phrase, 3 forbidden-pattern, 4 whose-bytes) and +2 tests in
`publish-mirror.spec.ts`. No regression.

**The stale-cached-PASS dependency was checked before trusting a green run.**
`{workspaceRoot}/.github/workflows/ci.yml` is present in `nx.json`'s
`targetDefaults.test.inputs` at `nx.json:69` (plan 09-01, PARITY-08). Without it the two `ci.yml`
rows would replay a pass computed before their subject existed. The three docs files were
already `test` inputs (`nx.json:61,63,64`). Every measurement above additionally used
`--skip-nx-cache` or a fresh input set.

Invariants confirmed by `git show --stat HEAD` (7 files, 363 insertions, 26 deletions) and
targeted diffs:

- `packages/github-cache/src/publish/publish-mirror.ts:146` and `:159` UNMODIFIED (Phase 10's
  TRUST-11 / OBS-05) -- the source hunks start at `:292`, and `:146`'s
  "a foreign-OS or evicted entry MISSes its same-OS restore" is still at line 146.
- `packages/github-cache/src/publish/publish-mirror.spec.ts:410`'s matching comment UNMODIFIED --
  the spec hunk starts at `:440`.
- `ci.yml`'s `publish-verify` own-OS-asset comment UNMODIFIED (now at `:1104`, past the last hunk
  at `:982`).
- `packages/github-cache/src/roundtrip/read-back.ts` UNMODIFIED (not in the commit).
- `ci.yml`'s `dogfood-seed` and `dogfood-verify` blocks UNMODIFIED relative to plan 09-05's
  commit -- the three `ci.yml` hunks are at `:385`, `:406` and `:982`; the dogfood blocks live at
  `:794`-`:852`, between the second and third hunk. 09-05's drift guard is green.
- `packages/github-cache/src/public-surface.spec.ts` and `packages/github-cache/src/index.ts`
  UNMODIFIED (PARITY-07) -- `DOCS_08_SITES` is spec-local and not in the barrel.
- `git diff --diff-filter=D HEAD~1 HEAD` -- no deletions.
- Working tree clean after the commit; no mutated state persisted on the branch.
- No `git stash`, no `git clean`, no `git reset` used at any point.
- STATE.md and ROADMAP.md NOT modified (worktree mode; the orchestrator owns them).

## Self-Check: PASSED

Created file exists:

- `packages/github-cache/src/docs-same-os-claims.spec.ts` -- FOUND

Commit exists:

- `474c1b5` -- FOUND
  (`docs(09-06): correct every same-OS-restore claim and reword the all-MISS warning`,
  7 files, 363 insertions, 26 deletions)

All six edited sites confirmed present by phrase search, and all seven intended paths confirmed
in the commit with `start-cache-server/index.js` absent from it.
