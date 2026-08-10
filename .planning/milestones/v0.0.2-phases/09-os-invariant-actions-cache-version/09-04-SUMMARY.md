---
phase: 09-os-invariant-actions-cache-version
plan: 04
subsystem: publish-observability
tags: [cache-version, compression-method, child-process, tdd, surfaced-never-gated]
status: complete
requires:
  - '09-01: nx.json test input on ci.yml (PARITY-08) -- inherited, not exercised by this plan'
  - '09-03: enableCrossOsArchive at all three call sites -- the landed reality this probe complements'
provides:
  - 'resolveCompressionMethod() -- an independent re-derivation of @actions/cache 6.2.0 getCompressionMethod'
  - 'CompressionMethod -- the two-value type this code path can return'
  - 'the resolved compression method in the publish log AND the publish job summary'
  - 'the @actions/cache bump note, on the assertion a bumper cannot avoid editing'
affects:
  - 'action/index.spec.ts: core.summary.write is now asserted TWICE, not once'
  - 'Phase 10 TRUST-12: this plan adds one child-process spawn to the publish path'
tech-stack:
  added: []
  patterns:
    - 'child-process fixture at the node:child_process seam -- NEW pattern, no in-repo analog'
    - 'grep-verifiable absence of a field READ, by never spelling the field name (D-05 applied to a source file rather than a spec)'
    - 'second core.summary.write() as an append, exploiting summary.js appendFile default'
key-files:
  created:
    - packages/github-cache/src/lib/compression-method.ts
    - packages/github-cache/src/lib/compression-method.spec.ts
  modified:
    - packages/github-cache/src/action/index.ts
    - packages/github-cache/src/action/index.spec.ts
    - packages/github-cache/src/pinned-deps.spec.ts
decisions:
  - 'spawnSync over spawn (09-RESEARCH C-02), a RECORDED deviation from D-14 wording; both of D-14 load-bearing clauses preserved'
  - 'the two unconsulted result fields are never SPELLED in the leaf, so the structurally-unconsulted claim is mechanically checkable'
  - 'the bump note went to pinned-deps.spec.ts because the checklist VER-05 names does not exist; recorded as a correction, not a silent relocation'
  - 'normal RED->GREEN two-commit sequence (this plan carries no one-commit rotation constraint, unlike 09-03 H1)'
metrics:
  duration: ~35 minutes active (one interruption at a spend-limit reset, resumed mid-Task-2)
  completed: 2026-07-28
  tasks: 3
  files: 5
  commits: 2 (RED + GREEN) + 1 (this summary)
requirements: [VER-05]
---

# Phase 9 Plan 04: The Compression-Method Probe Summary

The compression method `@actions/cache` actually resolved now reaches both the publish log
and the publish job summary, re-derived from scratch because the library will not tell us --
and the one case that separates a faithful re-derivation from the obvious wrong one is
asserted as the control and proven to fire.

## What Landed

| Commit | Gate | Contents |
|---|---|---|
| `183bdb7` | RED | `compression-method.spec.ts` -- six behavioural cases + two structural cases, failing at import because the module did not exist |
| `0999bd8` | GREEN | the leaf, its single import site, the summary/log surfacing, the spec accommodations, and the bump note |

`fb188ef` (the wave-2 base) is the parent of `183bdb7`, so the RED-before-GREEN ordering rests
on git history rather than on a claim.

### Why the probe exists

`getCompressionMethod` is unreachable through `@actions/cache`'s exports map -- the same
`ERR_PACKAGE_PATH_NOT_EXPORTED` wall VER-02 documents -- so the value has to be independently
re-derived rather than asked for. It is worth re-deriving because `getCacheVersion` pushes the
compression method **UNCONDITIONALLY** at `cacheUtils.js:162-163`, before and independent of
the `process.platform === 'win32' && !enableCrossOsArchive` branch at `:166`. So the
`enableCrossOsArchive: true` that plan 09-03 hardcoded at all three call sites **cannot rescue
a mismatch on this axis**: two runners that disagree about zstd disagree about the cache
version no matter what the flag says. This is the third component, and reporting it is how a
reader of a cross-OS MISS can tell which one moved.

### The derivation

`resolveCompressionMethod(): CompressionMethod` is synchronous and 4 statements long:
`spawnSync('zstd', ['--quiet', '--version'], { shell: false, windowsHide: true, encoding:
'utf8' })`, both streams coalesced into one string with `null -> ''`, `.trim()`, and
`=== '' ? 'gzip' : 'zstd-without-long'`.

The two result fields it refuses to consult are **never spelled anywhere in the file** -- named
by description instead -- so searching the leaf for either identifier returns nothing and the
"structurally unconsulted" claim is mechanically checkable rather than a matter of a reader's
judgement. This is D-05's grep-verifiable-absence pattern applied to a source file rather than
to a spec, and the contortion is comment-locked so a later tidy does not undo it. Verified with
`rg`, not `git grep`: the file was untracked at the moment of the check, and `git grep` returns
a **false zero** for untracked paths.

The parsed semver upstream computes at `:127` and then discards is deliberately not
reproduced, and the doc block says so in the imperative -- it is the part that looks
load-bearing and is not.

## Verification

All NINE battery commands exit 0 **at the committed tree** (`0999bd8`), re-run after the commit
with `git status --porcelain` still empty afterwards: `format:check`, `build`, `typecheck`,
`typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check`.

**Tests: 635 passed / 635, 35 files.** The base was 626 / 34; +8 for the new spec and +1 for
the new summary-line assertion in `action/index.spec.ts`.

- **`npm run check:action` exits 0 with an EMPTY diff** -- the structural proof of D-17.
  `start-cache-server/index.js` is not in either commit and was never modified. This plan
  carried no bundle obligation because the bundle's single entry
  (`start-cache-server/entry.ts`) does not reach `action/index.ts`, and the empty diff is what
  turns that from a prediction into a measurement.
- `git diff --name-only fb188ef..HEAD` lists **exactly the five planned paths and nothing
  else**. PARITY-07 respected: `public-surface.spec.ts`, `src/index.ts` and
  `src/test/consumer-contract.ts` are UNMODIFIED -- no new package export, env knob or action
  input. Nothing under `src/backend/`, no `cache-archive-path.ts`, no `ci.yml`, no docs.
- `git diff --diff-filter=D` over both commits shows no deletions.
- `resolveCompressionMethod` has **exactly one import site**, `action/index.ts:15`.
- `node_modules` came from `npm ci`, never a junction, so the bundle verdict is meaningful
  (a junction makes esbuild rewrite ~689 lines of the bundle with no source edit).

### RED evidence (`183bdb7`)

```
FAIL src/lib/compression-method.spec.ts
Error: Cannot find module '/src/lib/compression-method.js'
       imported from .../packages/github-cache/src/lib/compression-method.spec.ts
Test Files  1 failed | 34 passed (35)
     Tests  626 passed (626)
```

Red for the right reason -- the module did not exist. Note the honest limitation: this is a
whole-suite **import** failure, so none of the eight new assertions was evaluated at all in
RED. The RED gate therefore proves the spec is wired to a real subject; it does **not** prove
the individual assertions can fail. The four mutations below are what prove that, and that
division of labour is the reason they were run rather than reasoned about.

### Mutation testing -- all four applied, OBSERVED first-hand, reverted

Each reddened its named case and **only** that case: 1 failing test out of 635, never more.

| # | Mutation | Named case that went RED | Verbatim failure |
|---|---|---|---|
| M1 | read the exit-code field, returning `gzip` when it is not 0 | **case 4, THE CONTROL** -- "returns zstd-without-long on a NON-ZERO exit that still produced output" | `AssertionError: expected 'gzip' to be 'zstd-without-long' // Object.is equality` |
| M2 | concatenate stdout only | case 3 -- "returns zstd-without-long when the version banner arrives on stderr ONLY" | `AssertionError: expected 'gzip' to be 'zstd-without-long' // Object.is equality` |
| M3 | branch on `/\d+\.\d+\.\d+/` instead of on emptiness | case 6 -- "returns zstd-without-long for output no semver parser can read" | `AssertionError: expected 'gzip' to be 'zstd-without-long' // Object.is equality` |
| M4 | remove the `.trim()` | case 2 -- "returns gzip for whitespace-only output (the .trim() proof)" | `AssertionError: expected 'zstd-without-long' to be 'gzip' // Object.is equality` |

**M1 is the one that earns the control its place.** M1 *is* the `runHelper`-shaped
implementation -- and the implementation `promisify(execFile)` produces if written idiomatically,
since it rejects on a non-zero exit and the natural `.catch(() => '')` yields `''` -> `gzip`.
It fails on case 4 and nowhere else, so no other case in the matrix would have caught it. That
is precisely the broken-but-present-zstd scenario VER-05 names, and it is labelled THE CONTROL
in a comment so a later reader does not "simplify" it away.

After the final revert the suite returned to 635/635 and the implementation body is
byte-identical to its pre-mutation state (`probe`, `versionOutput`, and the emptiness branch
re-read directly). No mutated state persisted: `git status --porcelain` is empty at `0999bd8`.

## Deviations from Plan

### 1. [Plan/orchestrator conflict, resolved in favour of the orchestrator] TWO commits, not one

`09-04-PLAN.md` Task 3 says "create ONE commit staging exactly [the five paths]". The
orchestrator's dispatch instead specified the normal RED->GREEN sequence, explicitly noting
that **this plan carries no one-commit constraint** -- unlike 09-03, whose H1 forced a single
commit to avoid a fourth cache-version rotation window. That reasoning is correct and specific:
this plan touches the publish path only and changes no cache-version input, so splitting RED
from GREEN rotates nothing.

Resolved as two commits: `183bdb7` (RED, the spec alone) and `0999bd8` (GREEN, the remaining
four paths). The MVP+TDD gate is satisfied by a real failing `test(09-04):` commit rather than
by a recorded test-run split, which is the stronger form of the same evidence.

### 2. [Rule 2 - Missing critical functionality] The write-count assertion needed a CONTENT sibling

The plan directed updating `action/index.spec.ts:123` from one write to two and adding a
content assertion. Bumping the count in place and appending a content assertion to the *same*
test would have made one test carry two unrelated subjects. Instead the count moved to
`toHaveBeenCalledTimes(2)` in the existing OBS-01 test (it is a fact about that test's own
flow) and the surfacing got its **own** `it`, asserting `addRaw` was called once, with content
matching `compression method (@actions/cache): zstd-without-long`, and `addEOL: true` -- plus
that the value also reached `core.info`. A bare count of 2 is satisfied by two empty writes,
which is exactly why the content assertion is not optional.

### 3. [Rule 3 - Blocking] `SpawnSyncReturns` cannot express the ENOENT shape

`@types/node` declares `stdout: T` and `stderr: T` **non-nullable**
(`child_process.d.ts:1335-1343`), yet a real ENOENT outcome delivers both as `null`. So case 5's
fixture is unwritable without a cast, and the implementation's null coalescing looks redundant
to the compiler while being load-bearing at runtime. Both facts are comment-locked -- in the
spec's fixture builder and at the coalescing expression -- because "the type says this cannot
happen" is exactly the reasoning that would delete the `?? ''` and reintroduce a throw where
upstream swallowed.

### 4. [Formatting] Prettier reflowed one spec file

`npm run format:check` flagged `action/index.spec.ts`; `npx prettier --write` on that one file
resolved it. No production file was reformatted, so the bundle was unaffected.

## Corrections Recorded (not silently applied)

1. **The `@actions/cache` bump checklist VER-05 and D-13 name DOES NOT EXIST** -- zero hits for
   `checklist` across `docs/`, `packages/`, `README.md`, `CONTRIBUTING.md`. The note went above
   the `@actions/cache` assertion in `pinned-deps.spec.ts` instead, matching that file's own
   per-package `//` convention (`:34-38`, `:45-49`) rather than extending the describe-level
   block, so it sits next to the line a bumper must edit. The requirement's dangling reference
   is recorded in the comment rather than treated as satisfied.
2. **D-14's "use `spawn` directly" is deviated from, deliberately and on the record**
   (09-RESEARCH C-02). `spawnSync` preserves both of D-14's load-bearing clauses -- do not reuse
   `runHelper`, do borrow `shell: false` + `windowsHide: true` -- and adds one property `spawn`
   cannot: the exit code is *structurally* unread rather than deliberately ignored. Recorded in
   the spec header, not just here.
3. **`git grep` returns a false zero for an untracked file.** The acceptance criterion "shows no
   read of the result's exit-code or error field" was first checked with `git grep` while
   `compression-method.ts` was still untracked -- which cannot match anything and reads as
   confirmation. Re-verified with `rg`. Worth recording because the same instrument is used for
   several absence claims in this phase.

## Known Stubs

None. Every path this plan touches is wired and asserted, and the one value it produces reaches
two real surfaces.

## Threat Flags

None new. The plan's own register covers the surface this adds:

- **T-09-26** (a probe reporting gzip for a broken-but-present zstd) -- mitigated, and M1 is the
  proof the mitigation fires.
- **T-09-27** (injection through the spawn) -- `shell: false` with an explicit argv of hardcoded
  literals, no interpolation, no caller input; the argv is asserted by equality and the options
  object by whole-object equality, so an added or reordered flag fails.
- **T-09-28** (child-process output in a public job summary) -- only the derived two-value enum
  is surfaced. The raw concatenated output is used solely for an emptiness test and is never
  logged, so a localized or verbose zstd banner cannot reach the summary.
- **T-09-30** (a hanging zstd) -- **accepted**, per D-15, and asserted structurally.
- **T-09-31** (the value becoming a gate) -- surfaced, never gated, stated in the doc block and
  at the call site.
- **T-09-32** (the probe leaking into the bundle) -- one import site; empty `check:action` diff.
- **T-09-33** (a machine-dependent assertion) -- neither spec executes a real spawn.
- **T-09-SC** -- no new package. `spawnSync` is a `node:child_process` builtin, and no `semver`
  dependency was introduced.

## Follow-ups for Later Plans

- **Phase 10 TRUST-12** must count this plan's one added child-process spawn on the publish path
  when it records the exposure delta.
- Nothing in this plan is observable pre-merge in a way the other VER requirements are not; it
  runs on the publish path, which is `main`-push-gated (C-06). The value's *correctness* is fully
  closed by the fixture matrix, so unlike VER-06 and OBS-04 this requirement leaves **no
  `human_needed` item**.

## Self-Check: PASSED

- All 5 claimed source files exist on disk; both claimed commits (`183bdb7`, `0999bd8`) are in
  `git log`, with `fb188ef` as the RED commit's parent.
- `git diff --name-only fb188ef..HEAD` returns exactly those five paths -- no sixth file.
- `start-cache-server/index.js` absent from both commits and unmodified; `check:action` empty.
- All nine battery commands re-run at `0999bd8` and exit 0; `git status --porcelain` empty
  before and after.
- `STATE.md` and `ROADMAP.md` never modified, per worktree mode.
