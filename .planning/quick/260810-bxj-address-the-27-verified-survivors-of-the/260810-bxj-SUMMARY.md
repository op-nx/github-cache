---
phase: 260810-bxj
plan: 01
type: execute
status: complete
subsystem: guards-and-consumer-docs
tags:
  [
    quick-task,
    post-review-fix-pass,
    fail-closed-classifier,
    localizing-guards,
    census-rule,
    single-source,
  ]
requires:
  - PR #16 (milestone v0.0.2, OS-invariant cross-OS sharing)
  - quick 260809-uge (the previous 44-finding review-fix pass)
provides:
  - A fail-closed 422 asset-upload classifier (DEC-1)
  - A localizing per-job partition over the Windows read-only knob
  - One authored copy each of the OBS-03 label, the comment stripper and the workspace-root walk
  - The nx.json ESLint toolchain drift guard, at zero nx.json bytes
  - .planning/quick/260810-bxj-.../260810-bxj-deferred-items.md (the seven v0.0.3 items)
affects:
  - .github/workflows/ci.yml
  - eslint.config.mjs
  - docs/advanced.md
  - docs/trust-and-security.md
  - packages/github-cache/src (25 files)
  - start-cache-server/index.js (regenerated once, staged in its own commit)
  - .gitignore
tech-stack:
  added: []
  patterns:
    - partition-over-a-derived-set instead of a cardinality assertion
    - all-entries CODE conjunction for a benign-error branch
    - delete-the-count-or-assert-it-programmatically
    - one primitive plus one control suite instead of N copies
key-files:
  created:
    - packages/github-cache/src/lib/mirrored-by-label.ts
    - packages/github-cache/src/test/repo-file.spec.ts
    - .planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md
  modified:
    - packages/github-cache/src/lib/octokit-fault-reason.ts
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/dogfood-cross-os.spec.ts
    - packages/github-cache/src/test/repo-file.ts
    - eslint.config.mjs
    - .github/workflows/ci.yml
decisions:
  - DEC-1 honoured structurally, not literally -- an all-entries CODE conjunction on the
    upload path, with no message read, because the benign signal there is a code
  - DEC-2 honoured -- zero of the seven deferred items implemented; all seven recorded
  - nx.json left byte-unchanged; only T4-7's drift-guard half shipped
  - the T4-7 guard pins EACH SIDE to its own full set as a UNION -- `lint` equals the four
    ESLint names, `test` equals those four plus the runner. CORRECTED post-review from a
    SUBTRACTION form, which was blind to a removal from `test`
metrics:
  commits: 26
  duration: one session
  completed: 2026-08-10
  tests_before: 1090
  tests_after: 1169
  tests_delta: +79 (fully reconciled, zero unaccounted, no file lost a case)
---

# Quick Task 260810-bxj: Address the 27 verified survivors of the thermos review of PR 16 Summary

Closed all 27 verified survivors of the 8-reviewer thermos review of PR #16 across 26 atomic
commits, recorded the seven deferred structural items for v0.0.3, and left `nx.json`
byte-unchanged. The one live-CI semantic change is DEC-1's fail-closed 422 upload classifier.

**Commit range:** `a79e169..ffa6b62` on `gsd/v0.0.2-os-invariant-cross-os-sharing`, 26 commits.
**Acceptance battery:** all six gates green in the MAIN TREE.
**Test count:** 1090 -> 1169, every one of the +79 attributed to the task that added it.

---

## The 27 items: what changed, and the check that now fails if it regresses

### Tier 1 -- changes behaviour or what a consumer believes (8)

| Item | What changed | The check that fails on regression |
|------|--------------|-------------------------------------|
| **T1-1** | Added `hasOnlyFaultCode` (every `errors[]` entry is this one code, on a NON-EMPTY array) and switched the asset-upload catch to it. A benign `already_exists` no longer absolves an unrecognised sibling. | `octokit-fault-reason.spec.ts`, 15 new cases including a 10-row unreadable-body table; `publish-mirror.spec.ts` both twins assert `failed: 1` + `setFailed` fired. Reverting the predicate to the ANY scan reddens both twins. |
| **T1-2** | `docs/advanced.md`: replaced "the old assets remain prunable ... age out through the normal retention window" with the truth -- pre-v0.0.2 shards sit under the superseded `cache-mirror-*` tag prefix, `isShardTag` never admits them, nothing prunes them, and on a public repo they stay world-readable until deleted by hand. | PROSE ONLY (see the prose-deletion note below). Three specs read this file (`docs-adoption`, `docs-cross-os`, `docs-same-os-claims`) and all three pass; `git grep` confirms no row pinned the deleted sentence. |
| **T1-3** | Closed the `node:process` ban family: `BANNED_PROCESS_ACCESSORS` (`default`, `platform`, `arch`, `env`), TWO `paths` entries (prefixed + bare), P6's alternation one token wider, P8 widened by the five filesystem-layout keys plus `TMP`. No alias selector -- `default` in `importNames` reports at the import site regardless of binding name. | `lint-rules.spec.ts`: 7 new `EVASION_SHAPES` rows through the REAL root config via `lintFixture`, each consumed by two `it.each` loops, plus 2 new controls. MEASURED: removing the bare-specifier entry, narrowing P6, or reverting P8 each produce exactly one failure. |
| **T1-4** | `read-back.spec.ts` clock pinned to `2026-07-15T00:00:00Z` (the literal both sibling specs use), `vi.useRealTimers()` first in `afterEach`. The comment names the two produced tags. | The spec itself. MEASURED both directions: pinned = 38 passed; temporarily pinned to `2026-08-31` = exactly 1 failed with the reported message verbatim. |
| **T1-5** | Replaced `READ_ONLY_LEG_SITES = 3` with a per-job PARTITION over a DERIVED set, predicate = Windows leg AND sidecar AND portable target. Four clauses: set equality on names, in-set knob presence, out-of-set knob absence, and knob-site accounting. | `dogfood-cross-os.spec.ts`. MEASURED, four mutations: a new non-conforming Windows job (3 failed, naming the job), a leg losing its sidecar (3 failed incl. set equality), the knob copied onto `build` (1 failed, naming `build`), the knob hoisted to workflow-level `env:` (1 failed). |
| **T1-6** | `ci.yml`'s `cancel-in-progress` premise rewritten to match the file's own admission: PR runs DO write task-hash-keyed entries via the four non-push-gated sidecar jobs. Conclusion kept; both write families named with why neither is poisonable. | PROSE ONLY. `dogfood-cross-os` and `docs-same-os-claims` both read `ci.yml` raw and pass; no `DOCS_08_SITES` row was keyed to the claim. |
| **T1-7** | Added `lib/mirrored-by-label.ts` (leaf shape, unreachable from `serve()`, zero consumer-bundle delta) and routed all SEVEN authoring sites. Set re-derived by search, not trusted from the list; prose mentions left alone. | MEASURED: giving the writer its own literal again reddens 8 clauses in `publish-mirror.spec.ts`. Plus one new clause pinning the prefix as a PERSISTED contract (see deviation D3). |
| **T1-8** | Hoisted the `if (burnedShardTag)` short-circuit to the first branch in the loop body. Comment names both aggregate consequences (D-12's `failed++` no longer fires post-burn; `readMisses` stops incrementing) and why neither can affect the total-case gate. | New `publish-mirror.spec.ts` clause: oversized post-burn entries give `failed: 0`, no `core.error`, and `getMock` called exactly ONCE. MEASURED: moving the sentinel back reddens exactly that clause. |

### Tier 2 -- guards that read as coverage and are not (7)

| Item | What changed | The check that fails on regression |
|------|--------------|-------------------------------------|
| **T2-1** | Deleted both census blocks' counts, all four dead line references and the derived cross-file totals. Hook rationale kept, restated by WHICH FILES need it and why (including that `publish-mirror.spec.ts` must NOT get it). | PROSE ONLY -- deliberately no replacement count and no programmatic count, because the number answers no reader's question. Both files pass. |
| **T2-2** | De-byte-pinned the three count-pipeline clauses: every leading-indent anchor dropped, each whole-line pin split into its load-bearing tokens (`-a`, the log name, `wc -l | tr -d`, the `case` shape as three tokens, the floor). Floor and log name now returned from `windowsLegReasons` rather than re-spelled. | MEASURED: reindenting all three gate step bodies by one space leaves every clause GREEN (it reddened under the old pins). Dropping `-a` = 3 failed; gutting the numeric-shape pattern = 4 failed; lowering typecheck's floor = 1 failed. |
| **T2-3** | Re-derived the mask/write pairing PER SIDECAR BLOCK (each token write opens a region that must already have seen its own mask) instead of pairing by whole-file index. Deleted the "sound in both failure directions" claim and the pinned count. | MEASURED: removing the mask from ONE sidecar block reddens exactly one clause and the message names that block by line index. |
| **T2-4** | `capture-hashes-cli.spec.ts`: quantifier constrained from `[\s\S]*?` to `[^\n]*?`, enforcing the same-line adjacency its comment claims. | MEASURED against both regexes directly: a cross-line decoy (count on the `only-in-A` line, key on a later `value-changed` line) MATCHED under the old regex and does not under the new one; the real same-line output matches under both. |
| **T2-5** | One `stripLineComments` in `src/test/repo-file.ts`. **CORRECTED post-review:** this row claimed it replaced FIVE copies; only four were routed, and the fifth survived in `actions-cache-backend.spec.ts` -- an undocumented deviation, now D11. Line-leading is the DEFAULT; the trailing mode is opt-in and requires WHITESPACE before the marker. One caller opts in (`select-backend.spec.ts`). | `src/test/repo-file.spec.ts`, 13 cases: the three-fixture control plus the two truncation controls. MEASURED: renaming the knob branch away while leaving a trailing comment naming the token reddens 10 clauses (it passed under the line-leading strip); a legitimate trailing note on a correct file leaves all 44 green. |
| **T2-6** | Added the global-ignores assertion by SET EQUALITY over the five entries, plus a positive control that the block is a STANDALONE `ignores` object. | MEASURED: dropping each of the five entries in turn produces exactly one failure, five times over. |
| **T2-7** | Added the scan `compression-method.ts` claimed to have, for both result members it refuses, following `cache-archive-path.spec.ts`'s bracket discipline. | MEASURED: adding a branch on the exit status reddens the scan; so does one on the error object. Plus a three-fixture positive control (matches own derived probe, fires on code, silent on comment-only). |

### Tier 3 -- prose this PR's own changes falsified (10)

All ten are PROSE-ONLY fixes. Per the plan, the check for each is that **no surviving assertion
depended on the deleted claim** -- verified by search and by running every spec that reads the
file, never by inventing a test for a comment.

| Item | What changed | Verification that nothing depended on it |
|------|--------------|------------------------------------------|
| **T3-1** | Deleted `ci.yml`'s header job total AND Windows-legs count, plus the tilde-hedged leg count in the paging note. No replacement figure; the MECHANISM recorded instead (matrix legs are invisible to a literal-declaration count). | The plan's scan: no spelled-out job count survives in any `ci.yml` comment. Both raw readers of `ci.yml` pass. |
| **T3-2** | Restated the seven-job sidecar invariant as what actually holds (identical except the read-only env write on three consumer legs, plus the tee'd step and the gate step) and NAMED the forbidden repair with its cost. Reconciled the neighbouring "unguarded invariant" note. | Both raw readers pass; no `DOCS_08_SITES` row keyed to either false clause. |
| **T3-3** | `select-backend.spec.ts`: the "drives the REAL put" claim corrected -- no put is issued; the non-vacuity comes from the NARROWING. WR-01 citation kept. | Comment only; the file passes with its body unchanged. |
| **T3-4** | Corrected the shared-tmpdir claim (the archive moved to the repo-local `.nx/cache`, which makes the parallel-worker hazard slightly WORSE, now stated) and the same stale word in three `actions-cache-backend.spec.ts` test titles. | Titles changed, bodies unchanged; both files pass. |
| **T3-5** | Six comments now name `ReadOnlyBackend` instead of the superseded `ReadableBackend`, at the sites where the new type is DECLARED; the two inline ones say the factory declares it just above. | Comments only. NO annotation widened or narrowed -- that is T4-8, deferred. Full suite passes. |
| **T3-6** | Re-anchored `types.ts:46-50` by NAME (the discriminator in `backend/types.ts`); comment records that a 37-line insertion in the same changeset decayed the range. | Comment only. |
| **T3-7** | Deleted the two-commit-move-in-progress paragraph and its spelling lock from `release-asset-name.integration.spec.ts`; kept lines 4-26 (why the integration path, why the two files must not collapse). | Verified FIRST that `CORR_05_SITES` is `[] as const` (the move landed) and that no live gate greps this path for the directive token, so the lock had nothing left to protect. |
| **T3-8** | Collapsed three independent re-arguments of legacy-branch unreachability to ONE canonical statement in `release-asset-name.ts` (the module owning the predicate), written as an explicit three-step chain; `cleanup.ts` and `retention.ts` keep a pointer plus the single fact each owns. | Predicate and its spec coverage KEPT -- deleting exported surface is a consumer-contract change, and the canonical statement now says so explicitly. Full suite passes. |
| **T3-9** | `retention.ts` prefix prose: justification changed from an unenforced invariant to the recorded deliberate NON-ALIASING, and the omitted latent consequence added (a six-digit shard tag is a syntactically valid current asset name). | Prose only; the prefix is NOT single-sourced from the cache-key constant, per quick 260803-fcd's retraction. |
| **T3-10** | (a) `docs/trust-and-security.md` now points at the exact `package.json` pin guarded by `pinned-deps.spec.ts` -- the old target mentions no Nx and the "conformance fixture" it named does not exist. (b) Dropped the `maxBuffer` reason, which the ACCEPTED helper shares. (c) Narrowed the eslint claim from "the whole machine-dependent surface" to the listed accessors. (d) Cut `compare.ts`'s prior-revision narrative, keeping the invariant and the tempting-alternative block. | All four prose; battery green. (c) deliberately does NOT widen the lists -- an unmeasured widening surfaces as a red `lint` job on an unrelated commit. |

### Tier 4 -- the two reclassified as defects (2)

| Item | What changed | The check that fails on regression |
|------|--------------|-------------------------------------|
| **T4-6** | Routed all six bypassing sites through the workspace-root layer: two duplicate root constants, two verbatim reader re-implementations, two raw reads. Docstring SCOPED to "the specs that read through this layer". **CORRECTED post-review:** the docstring also hand-authored a count and a list of the out-of-scope files, and that list was wrong in BOTH directions (it named `docs-cross-os.spec.ts`, whose only occurrence is prose, and omitted `lib/release-asset-name.spec.ts` and `docs-trust.spec.ts`). The count and the list are gone; the set is derived by search and asserted by set equality in `repo-file.spec.ts`, and `lib/release-asset-name.spec.ts` is now routed. | `repo-file.spec.ts` adds a positive control that `readRepoFile` lands at the workspace root. The scoped absence gate passes over the five named files -- and is explicitly NOT read as proof all five landed, because `public-surface.spec.ts` never used the literal form; the full-suite run covers it. |
| **T4-7** | Drift guard only, at ZERO `nx.json` bytes. **CORRECTED post-review (see the addendum):** each side is pinned to its own full set -- `lint` EQUALS the four ESLint names AND `test` EQUALS those four UNION the runner. The shipped form subtracted the ESLint names from `test` before comparing and was BLIND TO A REMOVAL. No element count on either side. | `git diff --exit-code -- nx.json` clean, RUN FROM THE REPOSITORY ROOT. MEASURED, all five mutations: a fifth ESLint plugin on `lint` only = 2 failed; on `test` only = 1 failed; an unrelated new `test` entry = 1 failed; one ESLint package REMOVED from `test` = 1 failed; all four removed = 1 failed. The last two were GREEN under the subtraction form. |

### Also folded in (both named in CONTEXT.md as cheap fixes, not extra scope)

- **The jq element guard** (`ci.yml:1558`): applied the sibling's `select(type == "object")` shape at
  BOTH indexed levels (`.jobs[]` and `.steps[]`), not just the outer array. It shipped with NO check
  -- zero clauses pinned the jobs pipeline -- so a new `dogfood-cross-os.spec.ts` clause pins it,
  anchored on the jq expression and never on indentation. MEASURED: dropping either guard reddens it.
- **The `.gitignore` fold**: added the two record directories and the two binary payloads. The record
  directories are the sharper half -- an untracked one beside a capture pegs `workingTreeClean` to
  false, which is how a local hash reproduction proves its own provenance.

---

## DEC-1: the behaviour change, both twins, and the accepted trade

**This is the only item in the task that alters live CI semantics.**

### What changed

The asset-upload catch classified a 422 body benign whenever `already_exists` appeared ANYWHERE in
`errors[]`. That is the measured run-30767511870 payload shape: an `already_exists` sitting beside a
`code: custom` immutability rejection. All 65 permanently-rejected uploads counted as `skipped`,
`failed` stayed 0, the aggregate `setFailed` never fired, and both legs exited GREEN having mirrored
nothing. The failure surfaced one job later in publish-verify, naming the wrong subsystem.

`hasOnlyFaultCode` is now the predicate: **is EVERY entry this one code, on a NON-EMPTY array.**

Two properties are load-bearing and both are stated in the code:

1. **Non-empty.** `[].every(...)` is vacuously true, so without the length test an absent, null,
   non-array or empty `errors` would all answer benign -- reintroducing the guess the module exists
   to forbid, at the one call site whose purpose is to stop guessing.
2. **It reads NO message, deliberately.** DEC-1's field-scoped textual anchor governs only the paths
   whose benign signal IS a message -- `ensureShardRelease`'s burned tag, where `faultReason().message`
   yields the `pre_receive` decoy. Here the signal is a CODE, so a code-set conjunction is
   *structurally* immune to that decoy rather than merely careful about it. It satisfies DEC-1
   **structurally, not literally**, and a message read on this path would be the defect. The code
   comment says exactly this so a future reader does not "restore" a field-scoped read with nothing
   to scope to.

`hasFaultCode` is KEPT. `ensureShardRelease`'s create race needs ANY semantics and they are correct
there, because that branch proves the release exists by re-reading it -- a decoy sibling cannot make
the re-read succeed.

### Both twin specs re-authored against the new behaviour

Neither was adjusted to keep the old verdict green.

- **The masking spec.** Its title claimed it proved masking does NOT occur while its body asserted
  `skipped: 1, failed: 0`, which proved masking DOES occur. Re-titled to state what it asserts, and
  the body now asserts `failed: 1`, `skipped: 0`, the warning naming the status, GitHub's own code and
  GitHub's own message, and the aggregate `setFailed` firing.
- **Its reversed-order twin** (`already_exists` NOT first) asserted the same benign pair, and its
  comment argued that the fatal outcome would be WRONG -- "the genuine duplicate-upload race would be
  counted as a fault, and the publish job would redden on a race D-05 defines as benign". That was one
  more falsified-prose instance and, left standing, read as an instruction to narrow the predicate.
  Re-authored: expectations flipped to fatal, and the comment now records that **order-independence
  survives** (both orders reach the same verdict) and that the verdict is what changed.

### The accepted trade, stated plainly

**A genuine duplicate-upload race that arrives ALONGSIDE an unrecognised sibling in the SAME body now
fails closed and reddens the publish leg.**

That is deliberate, it is DEC-1's own recorded cost, and it is bounded: the recorded exposure is a
repository setting (immutable releases) whose re-enablement SHOULD be loud per `STATE.md:482`. It is
strictly preferable to the current behaviour, where a permanent policy rejection sitting beside an
`already_exists` exits GREEN having mirrored nothing. Spurious-red risk was measured rather than
guessed: immutability is disabled, the dead release was removed, and Window B (run 30807461616) went
full green with 69 assets.

The predicate was NOT narrowed to keep either twin green. Doing so would silently relax DEC-1.

---

## Count ledger

Three reviewers independently measured three different totals (29, 34, 35) for one file whose comment
claimed 16 -- inside a block titled "CENSUS CORRECTION". That is how this task started, so every count
is accounted for below.

### Hand-authored counts DELETED (no replacement figure authored)

| # | Where | What it counted | Why deletion rather than correction |
|---|-------|-----------------|--------------------------------------|
| 1 | `actions-cache-backend.spec.ts` | real-backend construction total | Wrong by 18; three reviewers got three answers. The number serves no reader of the hook. |
| 2 | `actions-cache-backend.spec.ts` | derived cross-file construction totals | Derived from (1). |
| 3 | `actions-cache-backend.spec.ts` | a list of construction LINE NUMBERS | Decayed on the first edit above them. |
| 4 | `select-backend.spec.ts` | write-trusted call-site count | Plus four dead line references pointing at a comment fragment, two closing braces and another comment. |
| 5 | `ci.yml:12` | job total | Argument never depended on it. |
| 6 | `ci.yml:12` | Windows-legs count | An UNDERCOUNT -- matrix legs are invisible to a literal-declaration count -- so a cost argument understating its own cost. |
| 7 | `ci.yml` paging note | tilde-hedged leg count | Same class, one job over. |
| 8 | `dogfood-cross-os.spec.ts` describe header | its own case count | Its own comment admitted it "HAS ALREADY GONE STALE TWICE" and instructed a same-commit hand correction -- a standing instruction to author a fresh number. |
| 9 | `dogfood-cross-os.spec.ts` M4 docstring | "the ORIGINAL five clauses" | **Advisory A1.** Falsified by the new `it`; the load-bearing distinction is WHICH SET, now named by where it is enumerated. |
| 10 | `dogfood-cross-os.spec.ts` M4 docstring | "of which there are now nine" | **Advisory A1.** Same sentence, same group. |
| 11 | `dogfood-cross-os.spec.ts` sink block | "The TEN body clauses above" | **Advisory A1.** The sibling count the header instructed sweeping. |
| 12 | `dogfood-cross-os.spec.ts` | `MASKED_TOKEN_SITES = 8` | Carried "RE-MEASURE and update this count HERE" -- the drift source. Replaced by per-block derivation, which needs no count. |
| 13 | `dogfood-cross-os.spec.ts` | `READ_ONLY_LEG_SITES = 3` | A cardinality assertion cannot localize. Replaced by the partition. |

Items 9, 10 and 11 are the three A1 counts. The plan named two; the third (the M4 pair is two
numbers in one sentence) made it three deletions across two docstrings beyond the header.

### Counts now asserted PROGRAMMATICALLY (or replaced by a set/relation)

| Where | The programmatic form | Not a count because |
|-------|----------------------|---------------------|
| `dogfood-cross-os.spec.ts` | the derived Windows-consumer set EQUALS three NAMES | A set of names cannot rot into a wrong integer, only into a wrong list -- which reads as the edit it is. |
| `dogfood-cross-os.spec.ts` | knob-site ACCOUNTING (file total == sum of per-job totals) | A placement identity, so it survives legs being added or removed. |
| `dogfood-cross-os.spec.ts` | mask/write pairing derived PER BLOCK | The block count comes from the token writes. |
| `dogfood-cross-os.spec.ts` | the count-pipeline floor read from `windowsLegReasons`' own parameter | Authored once per leg, never re-spelled per clause. |
| `lint-scope-drift.spec.ts` | the five global ignores by SET EQUALITY | Named entries; a failure says which one drifted. |
| `nx-target-inputs.spec.ts` | `lint` set-equals four NAMED packages; `test` minus `lint` == `['vitest']` | Set relations over named packages, explicitly no element count on either side. |

### Counts deliberately RETAINED as exact pins

`RECORD_ONLY_SURVIVOR_SITES = 2` stays. It cited the now-deleted `MASKED_TOKEN_SITES` as its
pin-exactly precedent, so it is re-argued on its own terms, and the distinction is real: a mask has a
per-block subject to derive FROM, whereas "exactly this many diagnostics were left unconverted" IS
the claim, with no per-site structure behind it.

### Net

**Thirteen hand-authored counts deleted. Zero new hand-authored counts introduced.** Six guards now
express the surviving obligations as sets, relations or derivations. Verified by the plan's own scan:
no spelled-out job count survives in any `ci.yml` comment.

---

## Test-count reconciliation: 1090 -> 1169

> **POST-REVIEW ADDENDUM.** The review-and-verification fix pass took the count to **1174**. The
> +5 is fully attributed there: `test/repo-file.spec.ts` 13 -> 17 (two trailing-marker direction
> controls for WR-08, plus gap 2's derived-exception-set clause and its non-vacuity control) and
> `dogfood-cross-os.spec.ts` 107 -> 108 (WR-01's token-write subject). No file lost a case. See
> `260810-bxj-REVIEW-FIX.md`. The table below describes the ORIGINAL pass and is left as measured.

The 1090 baseline was **measured**, not assumed: a detached worktree at `29c05eb` with a junctioned
`node_modules` (valid -- `package.json`, the lockfile and both vitest configs are untouched across the
range) reported exactly `1090 passed`. Per-file counts were diffed against HEAD.

| File | Before | After | Delta | Attributed to |
|------|--------|-------|-------|---------------|
| `dogfood-cross-os.spec.ts` | 84 | 107 | **+23** | +1 the jq element clause (task 5); +22 the T1-5 partition (3 in-set + 18 out-of-set + 1 set equality + 1 accounting, minus the 1 deleted cardinality clause) |
| `lint-rules.spec.ts` | 64 | 80 | **+16** | T1-3: 7 new `EVASION_SHAPES` rows x 2 `it.each` loops = 14, plus 2 new `FALSE_POSITIVE_CONTROLS` |
| `octokit-fault-reason.spec.ts` | 27 | 42 | **+15** | T1-1: 5 cases + a 10-row unreadable-body table |
| `test/repo-file.spec.ts` | 0 | 13 | **+13** | T2-5's control suite (new file) |
| `compression-method.spec.ts` | 8 | 16 | **+8** | T2-7: 2 forbidden members x (1 scan + 3 control loops) |
| `publish-mirror.spec.ts` | 59 | 60 | **+1** | T1-8's oversized-post-burn clause |
| `read-back.spec.ts` | 38 | 39 | **+1** | T1-7's persisted-prefix pin |
| `lint-scope-drift.spec.ts` | 6 | 7 | **+1** | T2-6's set-equality clause |
| `nx-target-inputs.spec.ts` | 29 | 30 | **+1** | T4-7's drift clause |
| **Total** | **1090** | **1169** | **+79** | Fully accounted |

**No file lost a single case.** The two legitimate negative contributors the plan anticipated did not
materialise as drops: T2-5's consolidation removed five stripper COPIES but no test cases (each copy
was a helper, and four already had controls that stayed), and T2-2/T2-3 replaced assertions *inside*
existing `it` blocks rather than merging blocks away. The task 5 count deletions were comment
deletions, not case deletions.

**Zero unaccounted-for delta, and zero drop** -- the failure condition did not occur.

---

## Verification

| Gate | Result |
|------|--------|
| `npm run test` | 44 files, **1169 passed** |
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run format:check` | clean |
| `npm run check:action` | clean, **MAIN TREE** |
| `npm run fallow:ci` | `No issues found`, 66 entry points |

Battery run per AGENTS.md: each target teed to a per-iteration log in the session temp dir with
`${PIPESTATUS[0]}` captured INTO A VARIABLE (never `exit ${PIPESTATUS[0]}` inline). Nothing under the
scratchpad was committed.

**Plan verification items:**

1. All 27 items landed; 0 of 7 deferred items implemented -- all seven recorded with a written reason.
2. Bundle coupling audited across all 26 commits -- see below.
3. Test delta reconciled case-by-case; no unaccounted-for drop.
4. `git diff --exit-code -- nx.json` clean. **CORRECTED post-verification: the plan declared this
   gate immediately after a `cd` into the package directory, where the pathspec matches nothing and
   the gate returns 0 vacuously. It was re-run from the repository root against the baseline commit,
   which is where the real evidence comes from, and the plan's gate is fixed.**
5. No surviving indentation-anchored pin on the count pipeline. **CORRECTED post-review, both
   halves: (a) the plan's unqualified "no surviving byte-pin" was FALSE -- 20 `^ {10}` anchors
   survived in `dogfood-cross-os.spec.ts`, three of them NEGATIVE assertions that a reindent
   silently satisfies; the three negatives are now `^\s+` and the must_have is scoped to what was
   actually done. (b) "no new hand-authored count" was FALSE -- the T4-6 docstring added one, with a
   list wrong in both directions; both are gone and the set is derived and asserted.**
6. Every bundled-source edit paired correctly with its bundle.
7. The T1-5 mutations each produced exactly the expected red, recorded in the commit message.

### Bundle-coupling audit (execution rule 2 / verification item 6)

The bundled module set was re-derived from the bundle's own `// packages/...` markers, never guessed.
Three commits touched a bundled source:

| Commit | Bundled sources edited | Bundle staged? | Verdict |
|--------|------------------------|----------------|---------|
| `863e0e8` | `lib/select-backend.ts` (comment) | no | **CORRECT** -- MAIN-TREE replay: checked out that commit's sources + bundle into the main tree, rebuilt, bundle byte-IDENTICAL. No delta, so no `index.js` needed. Tree restored. |
| `30f7db3` | three `backend/` modules (comments) | **YES** | **CORRECT** -- the bundle DID move (esbuild preserves these in-object `//` comments) and the regenerated bundle is in that same commit. |
| `be23e4a` | `lib/release-asset-name.ts`, `lib/retention.ts` (docstrings) | no | **CORRECT** -- its bundled source set is byte-identical to HEAD's, and HEAD's main-tree `check:action` is green, so the committed bundle is proven correct by transitivity. |

`30f7db3` is the interesting one: a *comment-only* edit moved the bundle. The plan's instruction to
run `check:action` rather than assume comment edits produce no delta is exactly what caught it.

**A worktree replay was attempted first and correctly rejected as non-authoritative.** All three
commits reported an identical `+689/-689` diff in which every changed line was a
`node_modules/...` -> absolute-path rewrite -- the documented junctioned-worktree false-drift. The
main-tree replay was used instead, which is why CONTEXT.md mandates the main tree for this task.

**Per-commit gate status:** every commit's `lint`, `typecheck`, `test`, `format:check` and
`check:action` were run green *before* that commit was created. A full 26-commit x 5-gate replay was
not re-run afterwards; the bundle dimension -- the only one where a commit can pass in isolation but
break its neighbour -- is audited exhaustively above.

---

## Deviations from the plan

Every deviation, with its reason. **CORRECTED post-verification: this section said "None is
silent" and there were ELEVEN, not ten -- D11 below was silent until the verifier found it.**

**D1 -- TDD commits are not split RED/GREEN.** Five tasks carry `tdd="true"`, whose protocol wants a
failing `test(...)` commit before the `feat(...)`. Execution rule 3 requires every commit to pass
`test` independently, which a RED commit cannot. Rule 3 is plan-specific and wins. The RED/GREEN
*discipline* was kept -- tests authored first, observed failing, then implemented -- and the observed
red is recorded in each commit message as a measured mutation.

**D2 -- `hasOnlyFaultCode` reads no message, where CONTEXT.md's earlier revision called the
field-scoped accessor MANDATORY.** Not a deviation from DEC-1 but from a superseded phrasing of it:
CONTEXT.md's own 2026-08-10 clarification records that the anchor governs message-signal paths only.
Documented at length in the code.

**D3 -- one clause added beyond T1-7's letter.** Single-sourcing the label made a writer/reader
divergence structurally impossible, but it also reduced a COORDINATED rename from seven consistent
edits to one -- and assets already in the shard carry the current prefix, so a renamed reader
recognises no label on any of them and reports a MISS. One clause in `read-back.spec.ts` pins the
prefix as a PERSISTED contract. Without it this commit would have removed the only thing making that
rename loud (Rule 2: missing critical functionality).

**D4 -- T1-5 gained a fourth clause the plan did not specify.** The mutation battery found that a
per-job partition cannot see a knob written OUTSIDE every job block, which the old cardinality gate
COULD: adding a workflow-level `env:` block left all three per-job clauses green. That hoist is the
likeliest regression of the set -- it is the natural "dedupe these three copies" cleanup and disables
every producer at once. The accounting clause closes it, stated as a placement identity rather than a
count.

**D5 -- T2-7 shipped a sixth stripper copy for exactly one commit.** Task 7 precedes task 8's
extraction, and the compression scan needs a comment strip. Adding a local copy kept every commit
independently green rather than ordering the fix behind the extraction; task 8 routed it through the
shared helper. Recorded in both commit messages.

**D6 -- T1-3's controls differ from the three the plan named.** All three named controls already
existed in the file (the direct member read as P1's evasion row, the CI env key and the relative local
import as controls), so duplicating them bought nothing. Added instead what the *widening* newly
needs: a named import of NON-banned process accessors (the ban is per-name, not whole-module), and two
env reads that merely CONTAIN a banned key, holding P8's `^...$` anchors in place.

**D7 -- advisory A2 applied as a correction to the plan's own control.** The `<behavior>` row asked
that "for every caller, a value containing a URL scheme survives the strip intact" while the opted-in
caller ran a bare trailing `//` strip, which truncates `https://` by construction and passed only
vacuously (`select-backend.ts` contains no `://` today -- measured). The trailing marker now requires
preceding WHITESPACE, which is what makes a URL scheme and a bare hash survive, and the stripper's
docstring says so.

**D8 -- T4-6's docstring is scoped, not made unconditionally true.** Further specs still author their
own levels-up walk and are deliberately out of scope (the defect was the false claim plus the duplicate
reader, not a repo-wide sweep). The docstring now claims to be canonical *for the specs that read
through this layer*.

**SUPERSEDED IN PART by the gap-2 fix (`e4f7237`), and this correction is itself the defect class.** As
first written this entry ended "and names the six exceptions" -- a hand-authored count in an artifact,
describing an enumeration the gap-2 fix then DELETED. Two things were wrong with it: the enumeration no
longer exists (the exception set is now DERIVED and asserted by a set-equality clause, which is the
enforcement), and the count was wrong anyway. The verification's own first census of that set was an
undercount too, because its search needle was single-line and one file carries its path literal on a
CONTINUATION line -- the line-oriented false zero this project's own tooling rules warn about, which
defeated the review, the verification and the plan's census in turn. `docs-trust.spec.ts` was the file
all three missed. See D11 and `260810-bxj-REVIEW-FIX.md` for the settled state.

**D9 -- one extra commit (26, not 25) for a false-RED gate the partition introduced.** The plan's T1-5
verify is a literal-absence gate on `READ_ONLY_LEG_SITES`, and the partition commit left the retired
name in two explanatory comments -- keeping the gate red on a correct file. That is this task's own
defect class inverted (a comment breaking a content gate), so the prose was reworded to "the retired
cardinality constant". The absence gate keeps its value: it stops the constant being reintroduced.

**D10 -- T3-10(c) narrows the claim and does not widen the accessor lists.** The plan allowed either;
widening is unmeasured and would need its own `EVASION_SHAPES` rows plus a clean package lint run, so
the claim was narrowed instead and the comment records what taking the widening would require.

**D11 -- THE STRIPPER CONSOLIDATION STOPPED ONE COPY SHORT, AND THAT WAS SILENT.** Added
post-verification, which is the point: this deviation is recorded here only because the verifier
found it, and "Ten deviations documented, none silent" above was therefore FALSE. Four of the five
copies were routed through `stripLineComments`; the fifth survived in
`actions-cache-backend.spec.ts` at two sites, with its "DUPLICATED here rather than extracted, and
that is deliberate" justification intact -- a justification citing as precedent two files this same
task had already consolidated. The plan instructed routing it in as many words and pre-emptively
rebutted that justification ("a comment stripper is a primitive, not a fact"). DEC-2 does not cover
it: T4-5 defers SPLITTING that file, not routing a primitive out of it, and this task edited the
file freely for T2-1, T3-4 and T3-5. Both sites are now routed and the justification comment says
what it does instead. Mutations recorded in the fix commit and in `260810-bxj-REVIEW-FIX.md`.

### Not deviations

`nx.json` is byte-unchanged. No dependency was added. None of `ci.yml`, `publish-mirror.ts`,
`dogfood-cross-os.spec.ts`, `capture-hashes.mjs`, `actions-cache-backend.spec.ts` or the
`ReadOnlyBackend` union was restructured -- all were edited in place per DEC-2. No guard was relaxed,
scoped down, skipped or deleted to reach green; where a stricter guard went red, the CODE changed.

---

## Known stubs

None. No placeholder, hardcoded-empty or TODO surface was introduced.

## Threat flags

None. No file in this task introduces network surface, an auth path, file-access pattern or schema
change beyond the `<threat_model>` register. The register's own dispositions were honoured: T-bxj-01
(task 2), T-bxj-02 (task 6), T-bxj-03 (task 3), T-bxj-04 (task 4), T-bxj-05 (the bundle audit above).

## Deferred items

All seven recorded in `260810-bxj-deferred-items.md` with a written reason each: T4-1 (`ci.yml`),
T4-2 (`publish-mirror.ts`), T4-3 (`dogfood-cross-os.spec.ts`), T4-4 (`capture-hashes.mjs`),
T4-5 (`actions-cache-backend.spec.ts`), T4-8 (`ReadOnlyBackend`), and T4-7a (the `nx.json`
`namedInputs` single-sourcing). **Zero are implemented.**

T4-7a carries the sharpest reason and an ordering constraint, both recorded: any `nx.json` byte change
rotates all five task hashes through Nx's `workspace:` node, making Phase 11's committed hash records
non-reproducible from HEAD -- and this milestone was sequenced expressly to prevent that class of
change. It must land EARLY in v0.0.3, before any new hash record, carrying the Phase 11 provenance
note and the LINT-04 guard repair (split before expanding -- `lint.inputs` contains a `^`-prefixed
entry).

---

## Self-Check: PASSED

- `packages/github-cache/src/lib/mirrored-by-label.ts` -- FOUND
- `packages/github-cache/src/test/repo-file.spec.ts` -- FOUND
- `.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md` -- FOUND
- All 26 commits `a79e169..ffa6b62` -- FOUND in `git log`
- Working tree clean apart from the untracked planning directory the orchestrator commits
