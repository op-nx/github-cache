---
phase: 09-os-invariant-actions-cache-version
plan: 03
subsystem: actions-cache-backend
tags: [cache-version, cross-os, guard, bundle, tdd]
status: complete
requires:
  - '09-01: nx.json test input on ci.yml (PARITY-08) so ci.yml assertions invalidate the test cache'
  - '09-02: 09-ROTATION-SIGNAL.md, the in-advance prediction this commit is written against'
provides:
  - 'CACHE_ARCHIVE_DIR -- the single authored `.nx/cache` literal'
  - 'enterWorkspaceRootCwd() -- the chdir/mkdir spec accommodation for all 21 real-backend construction sites'
  - 'an OS-invariant @actions/cache cache version (path literal + enableCrossOsArchive at all three sites)'
  - 'a construction-time cwd/GITHUB_WORKSPACE conjunction guard'
affects:
  - '09-04 (compression-method): confirmed OUT of the bundle graph by construction'
  - '09-06 (OBS-04 warning rewording): must match 09-ROTATION-SIGNAL.md''s axis wording'
  - 'Phase 10 CORR-02: CORR_05_SITES is now three rows, not four'
tech-stack:
  added: []
  patterns:
    - 'comment-stripped source scan with single-character character-class needles (VER-02 clause 2a)'
    - 'exact-equality import-list assertion instead of not.toContain (VER-02 clause 2b)'
    - 'process-global chdir hook with a symmetrical restore closure -- NEW pattern, no in-repo analog'
key-files:
  created:
    - packages/github-cache/src/test/workspace-root-cwd.ts
  modified:
    - packages/github-cache/src/lib/cache-archive-path.ts
    - packages/github-cache/src/lib/cache-archive-path.spec.ts
    - packages/github-cache/src/backend/actions-cache-backend.ts
    - packages/github-cache/src/backend/actions-cache-backend.spec.ts
    - packages/github-cache/src/serve.spec.ts
    - packages/github-cache/src/lib/select-backend.spec.ts
    - packages/github-cache/src/lint-rules.spec.ts
    - start-cache-server/index.js
decisions:
  - 'H1 honoured: ONE commit for all five requirements plus the bundle, which overrode the MVP+TDD separate-RED-commit gate (plan-authorised, see Deviations)'
  - 'toStrictEqual kept, but its stated rationale was MEASURED FALSE and corrected in the comment lock'
  - 'esbuild renamed 426 lines of vendored undici resolve2 -> resolve3; inspected and accounted for, not assumed'
metrics:
  duration: ~40 minutes
  completed: 2026-07-28
  tasks: 3
  files: 9
  commits: 1 (implementation) + 1 (this summary)
requirements: [VER-01, VER-02, VER-03, VER-04, VER-07, ROBUST-04]
---

# Phase 9 Plan 03: OS-Invariant Actions Cache Version Summary

The `@actions/cache` cache version no longer depends on which OS computed it: the archive
path is a hardcoded workspace-relative forward-slash literal, `enableCrossOsArchive: true`
sits at the correct positional index at all three call sites, and the cwd/`GITHUB_WORKSPACE`
identity that would silently invert the result now throws at construction -- all in ONE
commit, so the milestone gets one cache-version rotation window rather than four.

## What Landed

**Commit `47597a6`** -- `feat(09-03): make the Actions cache version OS-invariant`, containing
exactly the nine planned paths and nothing else.

| Requirement | Mechanism |
|---|---|
| VER-01 | `cacheArchivePath(hash)` returns `` `${CACHE_ARCHIVE_DIR}/nx-github-cache-${hash}.tar` `` with `CACHE_ARCHIVE_DIR = '.nx/cache'`. Module imports EXACTLY the type-only `{ Hash }`. |
| VER-02 | Hand-authored full-literal pin + comment-stripped source scan (11 bracket-obfuscated needles) + exact-equality import-list assertion + a 33-assertion non-vacuity control. |
| VER-03 | Flag hardcoded at the 5th positional for `restoreCache`, the 4th for `saveCache`, the 5th for the `lookupOnly` probe; pinned per call by whole-argument-array equality AND by a source-level ordered multiset `['restoreCache','saveCache','restoreCache']` plus a namespace-import equality. |
| VER-04 | Construction-time conjunction: `existsSync(join(cwd,'nx.json'))` AND `resolve(GITHUB_WORKSPACE ?? '') === resolve(cwd)` case-normalised. Assert-then-mkdir order. Factory still zero-parameter and synchronous. |
| VER-07 | One `mkdirSync(CACHE_ARCHIVE_DIR, { recursive: true })` after the guard. |
| ROBUST-04 | `start-cache-server/index.js` regenerated in the same commit, diff INSPECTED (below). |

**`enterWorkspaceRootCwd()`** (new, `src/test/workspace-root-cwd.ts`) accommodates all 21
real-backend construction sites across three spec files, with four comment locks (leak
hazard + measured `pool=5 isWorkerThread=true`; why no in-repo analog exists and that the
exception is forced; why `import.meta.url` is legitimate in a spec and broken in the bundle;
why the mkdir lives in the hook) and the rejected global-`setupFiles` alternative.

**Census correction, comment-locked rather than silently applied:** 09-RESEARCH.md's per-spec
table says `actions-cache-backend.spec.ts` constructs the real backend 15 times and hedges
`select-backend.spec.ts` as "probably". Both wrong. Actual: **17 direct** (16 + 1 in
`serve.spec.ts`) and `select-backend.spec.ts` **CONFIRMED** (4 call sites / 5 runtime
invocations) = **21 across THREE files**. `publish-mirror.spec.ts` module-mocks the factory
and correctly did NOT get the hook.

## Verification

All NINE battery commands exit 0 at the committed tree:
`format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`,
`check:action`, `pack:check`. Tests: **626 passed / 626**, 34/34 files.

- `npm run check:action` exits **0 with an empty diff** at the committed tree -- proving the
  committed bundle matches a fresh build, not merely that no rebuild was needed.
- `git status --porcelain` is **completely clean**; no `packages/github-cache/.nx` path, so the
  chdir hook fired in every file that needed it.
- `git log --oneline -1 --name-only` lists all nine paths; `git diff --diff-filter=D` shows no
  deletions.
- `09-ROTATION-SIGNAL.md` was committed at **`e7018d0`**, an ancestor of this commit -- the
  in-advance claim rests on git history and history confirms it.
- PARITY-07 respected: `public-surface.spec.ts`, `src/index.ts` and
  `src/test/consumer-contract.ts` are UNMODIFIED. `publish-mirror.ts`, `.github/workflows/ci.yml`,
  `docs/` and `README.md` untouched.
- All eleven forbidden tokens return **zero** matches in `cache-archive-path.spec.ts`, so the
  repo-wide searchability property the bracket needles exist to preserve holds.

### RED evidence (Task 1, uncommitted by design under H1)

`test`: 4 files failed, 6 tests failed / 561 passed / 59 skipped.
`typecheck`: `TS2305: Module '"../lib/cache-archive-path.js"' has no exported member 'CACHE_ARCHIVE_DIR'`.

VER-02's two clauses failed for **different reasons**, as required:

- clause 1 (literal): wrong VALUE -- still the temp-directory path.
- clause 2a (scan): wrong SHAPE -- 4 of 11 needles fired (`join`, `tmpdir`, `node:path`, `node:os`).
- clause 2b (imports): 3-entry actual vs the single expected entry.
- clause 2c (non-vacuity control): **all 33 PASSED** while the subject was red -- the instrument
  was proven able to fire before its silence was trusted.

The three hook-wired spec files failed in `beforeAll` with
`TypeError: The "path" argument must be of type string or an instance of Buffer or URL. Received undefined`
at `workspace-root-cwd.ts:79` -- i.e. for the missing constant, **not** because the fixture was
wrong. Their 59 assertions were therefore not evaluated at all in RED; M4/M5/M6 below are what
prove the VER-04/VER-07 assertions can fail.

### Mutation testing -- all six applied, OBSERVED first-hand, reverted

| # | Mutation | Went RED | Stayed GREEN | Verbatim failure |
|---|---|---|---|---|
| M1 | flag into `options`' slot on `saveCache` (`saveCache([path], key, true)`) -- exactly what upstream's wrong JSDoc invites | VER-03 clause 1 | 625 others | `AssertionError: expected [ …(3) ] to strictly equal [ …(4) ]`, diff showing `- undefined` |
| M2 | trailing `true` deleted from the `lookupOnly` probe | VER-03 clause 1 **and** the pre-existing D-04 probe assertion (2 tests) | 624 others | `expected [ …(4) ] to strictly equal [ …(5) ]` / `expected "vi.fn()" to be called with arguments: [ …(5) ]` |
| M3 | `import { sep } from 'node:path'` + `export const NATIVE_SEPARATOR = sep` -- a banned name that does NOT change the returned string | VER-02 clause 2a on `/\bs[e]p\b/` **and** `/n[o]de:path/`, plus clause 2b | **clause 1 GREEN** (623 others) | `cache-archive-path.ts's CODE now matches \bs[e]p\b ... expected true to be false` |
| M4 | conjunct 1 (cwd/`nx.json`) deleted | VER-04 conjunct 1 only | 625 others, incl. conjunct 2 | `AssertionError: expected [Function] to throw an error` |
| M5 | conjunct 2 (`GITHUB_WORKSPACE` comparison) deleted | VER-04 conjunct 2 only | 625 others, incl. conjunct 1 | `AssertionError: expected [Function] to throw an error` |
| M6 | `mkdirSync` deleted | VER-07 only | 625 others | `AssertionError: expected false to be true` |

**M3 is the discriminating one and its record is explicit:** clause 1 stayed GREEN, which is the
whole point -- it proves clause 2 catches something clause 1 cannot. The more obvious mutation
(rebuilding the path with a path builder) was **rejected as the proof** because it reddens clause 1
too on `win32`, so it would not distinguish the two clauses; M3's shape works on any OS.

After every revert the suite returned to **626/626**. No mutated state persisted: a residue scan
for every `void <symbol>` stub and `NATIVE_SEPARATOR` returns no match, and rebuilding the bundle
after the reverts reproduced the identical 242/216 diff, confirming byte-for-byte restoration of
Task 2's state.

### The bundle diff -- inspected, not assumed

458 lines changed (242 insertions / 216 deletions), which is far more than two modules' worth and
therefore had to be explained rather than waved through:

- **426 lines are pure identifier-rename churn** inside vendored `undici`: `resolve2` -> `resolve3`.
  Cause: the new `import { resolve } from 'node:path'` in `actions-cache-backend.ts` claims the base
  name `resolve` in the bundle's flat CJS scope, so esbuild bumps every pre-existing local shadow.
  Semantically inert -- they are `Promise` executor parameters.
- **32 added / 6 removed lines are exactly these two modules' changes**: the two new builtin
  `require`s (`node:fs`, `node:path`), `CACHE_ARCHIVE_DIR`, the new template, both guard conjuncts
  with their messages, the `mkdirSync`, and the flag at all three sites (`void 0, void 0, true`;
  `void 0, true`; `true` appended after the `lookupOnly` object). Removed: the old `node:os` /
  `node:path` requires, the old temp-dir template, the two old bare calls.
- **Zero `__commonJS` registrations added or removed**, so no new module entered the bundle graph --
  `compression-method.ts` (09-04) and `dogfood-body.ts` stay out by construction, as predicted.
  Line count 68,938 -> 68,964 (+26), matching the 32/6 non-churn figure exactly.
- Tripwire clean: no `../../../node_modules` paths (this worktree used `npm ci`, never a junction).

## Deviations from Plan

### 1. [Plan-authorised] TDD-sequence exception -- no separate `test(09-03):` RED commit

This phase runs `MVP_MODE=true` and `TDD_MODE=true`, whose task-scoped gate normally requires a
separate RED commit before the implementation commit. That is **structurally incompatible with H1**:
splitting RED from GREEN would give the milestone a fourth cache-version rotation window where D-30
says three, and would falsify the "expected once" prediction already committed at `e7018d0`
(09-ROTATION-SIGNAL.md). H1 / C-04 / D-29 / D-30 and the 09-02 prediction are the more specific
instruction and the plan argues the case explicitly, so **H1 won** and exactly one implementation
commit was created.

The RED evidence is therefore the recorded test-run split above, not a commit. Deliberate,
plan-authorised, and flagged here for the end-of-phase TDD review rather than left as an omission.

### 2. [Rule 1 - Bug] A comment lock asserted a mechanism that is FALSE, measured

While applying M1 I noticed the `toStrictEqual` rationale I had written was an unverified claim:
*"toEqual treats a trailing `undefined` as absent, so it would ACCEPT a shorter array whose missing
tail is the flag."* Rather than ship it, I probed vitest 4.1.10's actual equality internals
(`@vitest/expect/dist/index.js:213,408` -- `toEqual` runs `equals` with `hasDefinedKey`, which
compares the COUNT of defined keys) across all eight argument shapes this clause could see.

**Result: `toEqual` and `toStrictEqual` return the SAME verdict on every one.** The claim was false.

The comment lock was rewritten to state the measurement, to name the plausible-but-wrong assumption
so a future reader does not re-derive it, and to identify the *actually* load-bearing choice in that
test -- asserting the WHOLE array instead of indexing single positions, which pins the flag's index
under either matcher. `toStrictEqual` is kept for what it genuinely adds (type/class identity,
sparse-array holes), not for a strength it does not have here.

This is exactly the Phase 8 failure class (a false claim inside a comment lock reads as
authoritative), caught before commit.

- **Found during:** Task 3, M1
- **Files modified:** `packages/github-cache/src/backend/actions-cache-backend.spec.ts`
- **Commit:** `47597a6`

### 3. [Rule 1 - Bug] A pre-existing exact-args assertion contradicted VER-03

`actions-cache-backend.spec.ts`'s D-04 test pinned the probe's arguments with
`toHaveBeenCalledWith(..., [], { lookupOnly: true })` -- an EXACT match, so adding the flag broke it.
Left unfixed it would have been a green-looking contradiction of VER-03 clause 1 in the same file.
The trailing `true` was added with a comment stating why the two assertions must agree (D-10).

- **Found during:** Task 2, first GREEN run (the only remaining failure)
- **Files modified:** `packages/github-cache/src/backend/actions-cache-backend.spec.ts`
- **Commit:** `47597a6`

### 4. [Rule 2 - Missing critical functionality] Stale counts in `lint-rules.spec.ts` prose

Deleting CORR-05 row 1 left four "four extant CORR-05 sites" statements elsewhere in the same file
factually wrong. Rotting comment locks are the exact drift `CORR_05_SITES`' own removal schedule
exists to prevent, so the count-bearing prose was made count-free (`:43`, `:266`, `:343`, `:785`)
while the two **historical** statements were preserved deliberately: the doc block now records
Phase 7's original FOUR/FOUR figure, the removal, and both original miscounts -- including the
ROADMAP SC3 three-vs-four lock, with the note that SC3 now names the right number *for the wrong
reason*. A removed miscount lock is indistinguishable from a miscount that never existed.

- **Files modified:** `packages/github-cache/src/lint-rules.spec.ts`
- **Commit:** `47597a6`

### 5. [Formatting] Prettier reflowed two spec files

`npm run format:check` flagged `cache-archive-path.spec.ts` and `actions-cache-backend.spec.ts`;
`npx prettier --write` on those two files resolved it. Neither production file was reformatted, so
the bundle was unaffected.

## Corrections Recorded (not silently applied)

Per the house pattern, these are stated in the commit body and in comment locks rather than edited
into the source documents:

1. **FIVE ci.yml sidecar sites, not four** -- `:236`, `:310`, `:357`, `:432`, `:895` (and
   `integration` is a two-leg matrix, so six job-legs). `REQUIREMENTS.md:335` and `ROADMAP:286` both
   say "four" and are WRONG.
2. **Spec census 17 direct / 21 total across THREE files**, correcting 09-RESEARCH.md's 15/16 and its
   `select-backend.spec.ts` "probably".
3. **`saveCache`'s JSDoc is inverted** -- verified first-hand against the exact-pinned
   `@actions/cache@6.2.0` `lib/cache.d.ts`: JSDoc `:64-65` documents `enableCrossOsArchive` before
   `options`, the real signature `:68` is the reverse. `restoreCache`'s JSDoc (`:53-55`) happens to
   match its signature; only `saveCache`'s is wrong. M1 applies exactly this mistake and observes it RED.
4. **`getCacheVersion` component gating** re-read first-hand at `cacheUtils.js:157-172`: paths
   (`:159`) and compression method (`:162-163`) are pushed **unconditionally**; `windows-only`
   (`:166`) only when `process.platform === 'win32' && !enableCrossOsArchive`. This is what makes the
   both-legs all-MISS attributable to the PATH and an asymmetric signal diagnostic of a half-landed change.

## Known Stubs

None. Every code path this plan touches is wired and asserted.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema at a trust boundary. The
guard reads only `process.cwd()` and `GITHUB_WORKSPACE`, both pre-existing ambient values; no new
package, env knob, action input or barrel export (`public-surface.spec.ts` passes UNEDITED, which is
the proof for T-09-25).

## Follow-ups for Later Plans

- **09-06** must reword the OBS-04 warning with an axis wording that MATCHES
  `09-ROTATION-SIGNAL.md` (the `@actions/cache` cache VERSION) and must retain the substring
  `restored as a MISS`.
- **H5 / C-06** remains open by design: the rotation signal can only be consumed on the first `main`
  push after merge. Nothing pre-merge can produce it (`ci.yml:3-7` filters pushes to `main`;
  `publish` is push-gated), and the plan explicitly forbids authoring a pre-merge check that could
  satisfy it.
- **Phase 10** inherits a three-row `CORR_05_SITES`.

## Self-Check: PASSED

- All 10 claimed files exist on disk (9 in the implementation commit + this summary).
- All 3 claimed commits exist in `git log`: `47597a6` (implementation), `06e71d0` (this summary),
  `e7018d0` (09-ROTATION-SIGNAL.md).
- `git merge-base --is-ancestor e7018d0 47597a6` succeeds -- the in-advance prediction provably
  precedes the commit it predicts.
- `git log -1 --name-only` on `47597a6` lists exactly the nine planned paths.
- `git log --name-only` over the two production files shows **only** `47597a6` within this plan
  (`83ac4fd` is a prior-phase commit), satisfying "no other commit in this plan touches them".
- `git status --porcelain` empty; `STATE.md` and `ROADMAP.md` never modified, as instructed for
  worktree mode.
