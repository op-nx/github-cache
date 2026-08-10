---
phase: 10-os-invariant-releases-mirror
plan: 02
subsystem: infra
tags: [github-releases, octokit, observability, attribution, vitest, tdd]

# Dependency graph
requires:
  - phase: 10-01
    provides: the measured pre-rename baseline, and the census that proved `label` EMPTY on all 122 shard assets -- which is what makes this field genuinely new rather than partially populated
  - phase: 09-os-invariant-actions-cache-version
    provides: VER-01 + VER-03, which broke publisher-equals-producer and are the entire reason OBS-03 carries a retraction
provides:
  - a 4th positional `label: string` on `PublishClient.uploadReleaseAsset`, forwarded by the real Octokit adapter into `octokit.rest.repos.uploadReleaseAsset`
  - a per-run hoisted `mirrored-by: <os>` value naming the PUBLISHING leg's OS, comment-locked with the producing-OS reading explicitly retracted
  - a machine-independent OS axis (`it.each(CACHE_OS_VALUES)` with `cachePlatform` partial-mocked) so the label claim is not sampled at rate ZERO on the ubuntu-only `test` job
affects: [CORR-02 asset rename, RETAIN-04 cleanup filter, XOS-02 post-rename read verification, 10-VERIFICATION, 10-SECURITY]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Release `label` metadata as the attribution channel, deliberately outside the lookup name"
    - "Partial `vi.mock` of `release-asset-name.js` replacing ONLY `cachePlatform`, keeping `CACHE_OS_VALUES` real so the it.each axis is honest"
    - "A tuple-derived expected OS (`CACHE_OS_VALUES[0]`) instead of a hand-authored literal"

key-files:
  created: []
  modified:
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
    - packages/github-cache/src/action/index.ts
    - packages/github-cache/src/action/index.spec.ts

key-decisions:
  - "The label is a 4th POSITIONAL parameter, not an options bag (D-09), following the `ref` 4th positional already shipped on the sibling `createPublishClient` seam"
  - "`cachePlatform()` is hoisted above the hash loop (D-10) and the comment says plainly that moving it back inside is behaviourally identical -- the hoist is a readability and cost choice, guarded only by the multi-hash called-ONCE case"
  - "The baseline expected label derives from `CACHE_OS_VALUES[0]` (`windows`), not the literal `'linux'`, so on the ubuntu-only `test` job even the four baseline argument-array assertions redden against an engine that read the ambient platform"
  - "`npm run build:action` was NOT run, and that is the correct outcome: `uploadReleaseAsset` and `publishMirror` are both absent from the committed bundle (measured), so the bundle delta is provably ZERO"

patterns-established:
  - "Whole-object adapter assertion: one `toHaveBeenCalledWith` over the entire Octokit call object, carrying `name` AND `label` together, so a mistake overwriting the filename with the label reddens in the same case"
  - "Call-count clause paired with every absence/uniqueness claim: `toHaveBeenCalledOnce` on the platform mock AND `toHaveLength(2)` on the upload calls, because either alone is satisfiable by a run that uploaded nothing"

requirements-completed: [OBS-03]

coverage:
  - id: D1
    description: "Every asset `publishMirror` uploads carries `mirrored-by: <os>` as the 4th member of the upload argument array, proven over every `CACHE_OS_VALUES` member with `cachePlatform` mocked"
    requirement: "OBS-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/publish/publish-mirror.spec.ts#publishMirror mirrored-by label (OBS-03, D-09/D-10/D-11) > stamps every upload with the %s publishing leg as part of the ONE upload argument array"
        status: pass
    human_judgment: false
  - id: D2
    description: "`cachePlatform()` is called exactly ONCE per `publishMirror` run (the hoist), and both uploads of a two-hash run carry the identical label"
    requirement: "OBS-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/publish/publish-mirror.spec.ts#publishMirror mirrored-by label (OBS-03, D-09/D-10/D-11) > calls cachePlatform exactly ONCE per run (the hoist), stamping both uploads with the same label"
        status: pass
    human_judgment: false
  - id: D3
    description: "The real Octokit adapter forwards `label` into `octokit.rest.repos.uploadReleaseAsset` alongside an unchanged `name`, so the label reaches GitHub rather than stopping at the engine's seam"
    requirement: "OBS-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/action/index.spec.ts#createPublishClient.uploadReleaseAsset label forwarding (OBS-03, D-09) > forwards the label into the Octokit call alongside an unchanged name"
        status: pass
    human_judgment: false
  - id: D4
    description: "The label is observably present on a real Release asset after a default-branch push (`gh api ... /assets` returning a non-empty `label`)"
    verification: []
    human_judgment: true
    rationale: "The `publish` job is sync-gated to a trusted default-branch push, so no local or PR run can exercise the live upload. OBS-03's requirement text is about the code recording the field and is satisfied by D1-D3; this row exists so the first post-merge push is actually looked at rather than assumed."

# Metrics
duration: 13min
completed: 2026-07-29
status: complete
---

# Phase 10 Plan 02: The mirrored-by Label Summary

**Producer attribution now lives in the Release `label` field -- stamped once per run by the publishing leg, forwarded to the wire by the real Octokit adapter, and comment-locked so it can never be read as naming the producing OS.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-29T12:39Z
- **Completed:** 2026-07-29T12:52Z
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments

- `PublishClient.uploadReleaseAsset` gained a 4th positional `label: string` and the engine
  passes `mirrored-by: <os>` on every upload -- so attribution exists as metadata BEFORE
  CORR-02 removes it from the asset name, and never lapses.
- The real Octokit adapter forwards it to `octokit.rest.repos.uploadReleaseAsset`. That was
  the load-bearing half: TypeScript accepts a contextually-typed adapter declaring only
  three parameters against a four-parameter interface, so the forgotten-adapter failure mode
  typechecks clean, passes every engine test (which asserts against a fake), and silently
  drops the label on every real upload. It is now caught by a test rather than by review.
- The retraction is comment-locked at the construction site: the value names the PUBLISHING
  leg's OS, with two independent reasons stated (there is no producing-OS field to read --
  `listCacheEntries` yields `{ key }` only and the adapter maps every row to
  `{ key: cache.key }`; and Phase 9's VER-01/VER-03 broke publisher-equals-producer, so a
  producing-OS reading would be WRONG in exactly the cross-OS case the label serves).
- The OS axis is machine-independent: `it.each(CACHE_OS_VALUES)` with `cachePlatform`
  partial-mocked to each member. No `'linux'` literal was authored anywhere.

## Task Commits

1. **Task 1: The engine stamps mirrored-by on every upload, once per run**
   - `5c47111` (test) -- RED: the 4th-argument assertions, the OS axis, the called-ONCE case
   - `21385b8` (feat) -- GREEN: the interface parameter, the hoist, the comment lock
2. **Task 2: The real Octokit adapter forwards the label to GitHub**
   - `1b4bfbd` (test) -- RED: the whole-object adapter assertion
   - `c555cb7` (feat) -- GREEN: `label` in the adapter signature and the Octokit call object

No REFACTOR commit in either task: nothing needed cleaning up.

## Files Created/Modified

- `packages/github-cache/src/publish/publish-mirror.ts` -- 4th positional `label` on the
  `PublishClient` seam (plus one doc-block sentence), `cachePlatform` added to the EXISTING
  `../lib/release-asset-name.js` import, the hoisted `const label` with the retraction
  comment lock, and the 4th argument at the upload call. `PublishOptions` untouched.
- `packages/github-cache/src/publish/publish-mirror.spec.ts` -- the partial `cachePlatform`
  mock, `PUBLISHING_OS`/`LABEL` derived from the real tuple, the 4 existing argument-array
  assertions extended, the `it.each(CACHE_OS_VALUES)` group, the multi-hash called-ONCE case.
- `packages/github-cache/src/action/index.ts` -- `label` in the adapter signature and as a
  property of the Octokit call object, with the Octokit-verified safety facts recorded.
- `packages/github-cache/src/action/index.spec.ts` -- the whole-object label-forwarding case.

## Which kind of RED was achieved

**ASSERTION-level in both tasks, not import-level.** Named explicitly because plan 09-04's
RED was a whole-suite IMPORT failure, which proved the spec was wired to a real subject and
evaluated none of its assertions.

| Task | RED evidence | Why it is assertion-level |
|------|--------------|---------------------------|
| 1 | `8 failed \| 20 passed (28)` | The suite imported and 20 unrelated cases still executed. Every failure was a recorded-argument-array mismatch, printed as `- "mirrored-by: windows"` against a 3-element received array. |
| 2 | `1 failed \| 11 passed (12)` | The 11 sibling cases in the same file passed. The single failure was the absent `label` property inside the recorded Octokit argument object. |

The 8 Task 1 failures decompose exactly as the plan predicted: the 4 pre-existing
argument-array assertions + the 3 `it.each` OS cases + the 1 called-ONCE case.

## Mutation checks (predicted first, then observed)

All three were applied to the working tree, observed, and reverted. Nothing was committed
mutated.

| Mutation | Predicted | Observed | Verdict |
|----------|-----------|----------|---------|
| Move `const label` back INSIDE the loop | reddens the called-ONCE case and NOTHING else | exactly 1 failure: `calls cachePlatform exactly ONCE per run (the hoist)` | as predicted |
| Drop the 4th argument at `client.uploadReleaseAsset(...)` | reddens all 4 argument-array assertions + the `it.each` group + the called-ONCE label array = 8 | exactly those 8, the same set as the Task 1 RED | as predicted |
| Remove `label` from the Octokit call object | reddens exactly the new adapter case and nothing else | `1 failed \| 679 passed (680)` across the WHOLE suite, the failure being that case | as predicted |

**What the hoist guard does NOT catch, stated plainly** (the plan asked for this, and
RESEARCH H-7(c) predicted "nothing should redden"): the hoist is not a correctness
invariant. Moving the construction inside the loop produces an identical label on every
iteration, because the platform cannot change mid-run. RESEARCH's prediction was that
NOTHING would redden; the called-ONCE case added by this plan is what makes the move
detectable at all, and it detects only the extra `cachePlatform` calls -- never a wrong
label. Anyone later reading the hoist as protected beyond that is over-reading it, which is
why the source comment says so at the construction site rather than only here.

## ROBUST-04 / bundle obligation: ZERO, measured not assumed

The plan forbade `npm run build:action`, on the ground that neither edited file is
`serve()`-reachable. Verified rather than inherited, with a positive control so a false zero
could not read as confirmation:

```
rg -uu -c -F 'uploadReleaseAsset' start-cache-server/index.js   -> exit 1 (no match)
rg -uu -c -F 'publishMirror'      start-cache-server/index.js   -> exit 1 (no match)
rg -uu -c -F 'cachePlatform'      start-cache-server/index.js   -> 2, exit 0   (positive control)
```

`git diff --stat -- start-cache-server/index.js` prints nothing at HEAD. The correct delta
is zero and the tree shows zero.

## Decisions Made

- **Baseline expected OS = `CACHE_OS_VALUES[0]`, not `'linux'`.** The it.each group is the
  clause that bites on every machine. But index 0 is `windows`, so on the ubuntu-only `test`
  job the four baseline assertions ALSO redden against an engine that read the ambient
  platform instead of calling `cachePlatform()`. The source comment marks that as a bonus,
  not a guarantee -- on a Windows workstation the two coincide again, and overstating it
  would be the same class of error OBS-03's retraction exists to prevent.
- **The mock's return value is set in `beforeEach`, not in the `vi.mock` factory.** The
  file-level `afterEach` runs `vi.resetAllMocks()`, which discards a factory-supplied
  implementation after the first test. This is the same reason `action/index.spec.ts` keeps
  its own restoring `beforeEach`, and it is recorded because a factory default here would
  have worked for exactly one test and then silently returned `undefined`.
- **Both `.mock.calls[...][1]` index reads were left alone**, as the plan required: index 1
  is the NAME and stays the name after a 4th parameter is appended. Confirmed by diff.

## Deviations from Plan

### 1. [Documentation] One acceptance-criteria grep is unsatisfiable as literally written

- **Found during:** Task 1 acceptance verification
- **Criterion:** "`rg -c 'toHaveBeenCalledWith\(\s*expect\.not' publish-mirror.spec.ts`
  returns 0 (Phase 9 gap G3)."
- **Observed:** it returns **1**, and did so before this plan started.
- **Cause:** the single hit is a COMMENT at `publish-mirror.spec.ts:596`, introduced by
  Phase 9's Nyquist gap-closure commit `5184427`, which spells the forbidden shape while
  explaining why the surrounding assertion deliberately does NOT use it.
- **Resolution:** the comment was NOT deleted. It is load-bearing prose from the 09-VALIDATION
  G3 fix and deleting it to satisfy a lexical count would destroy the explanation that keeps
  the correct shape from being "tidied" back. The criterion's INTENT holds and was measured:
  comment-stripped, the count is **0** in both line-oriented and multiline (`-U`) modes, so no
  absence claim in this spec uses a negated matcher inside `toHaveBeenCalledWith`.
- **Standing lesson this reproduces:** Phase 8's recorded finding that a grep-verifiable
  ABSENCE claim must not spell the token it forbids anywhere in the file -- including in the
  sentence explaining the rule. A future acceptance grep of this shape must strip comments.
- **Committed in:** no code change.

### 2. [Process, self-inflicted] A mutation revert discarded an uncommitted GREEN edit

- **Found during:** Task 2, immediately after mutation check 3
- **Issue:** mutation 3 was applied to `action/index.ts` while the GREEN edit to that same
  file was still uncommitted. `git checkout -- <file>` then reverted to HEAD, discarding both
  the mutation and the real edit.
- **Fix:** re-applied the adapter edit, re-verified the full suite (`680 passed`), then
  committed. No content was lost -- the edit is byte-equivalent to what was measured green.
- **Lesson for later waves:** commit GREEN *before* mutating, so a mutation revert is always
  a revert to the intended state. Cheap to avoid, and it cost one re-apply here.

---

**Total deviations:** 2 (1 criterion-wording correction, 1 self-inflicted process slip).
**Impact on plan:** none on the deliverable. No scope creep, no prohibition breached, no
requirement claimed beyond what was measured.

## Prohibitions: verified held

| Prohibition | Held? | Evidence |
|-------------|-------|----------|
| No OS through `PublishOptions` | yes | `interface PublishOptions { readonly now?: Date; }` unchanged |
| Label asserted inside the `uploadReleaseAsset` argument array only (D-11) | yes | 4 extended `toHaveBeenCalledWith` argument lists + one `toEqual` over `.mock.calls`; no separate label matcher exists |
| No negated matcher inside `toHaveBeenCalledWith` | yes | 0 in code (see deviation 1 for the comment-only hit) |
| No hand-authored `'linux'` label expectation | yes | `PUBLISHING_OS = CACHE_OS_VALUES[0]`; the axis is `it.each(CACHE_OS_VALUES)` |
| No comment claiming the label answers which producer's bytes a reader received | yes | the construction-site comment states the opposite in as many words; `docs-same-os-claims.spec.ts`'s `retracted` regex (`/whose byte[s]/i`) matches nothing in either edited source file, and its four-file scope is unchanged by this plan |
| `npm run build:action` NOT run | yes | not invoked; zero bundle delta measured above |

## Issues Encountered

The engine imports both `releaseAssetName` and `cachePlatform` from the same module, and the
partial mock replaces only the latter -- so it was worth confirming that the name assertions
stay self-consistent. They do: the spec and the engine both derive the name through the same
real `releaseAssetName`, so the comparison is unaffected regardless of whether the internal
call sees the mock.

## Verification at HEAD (`c555cb7`)

| Check | Result |
|-------|--------|
| `nx run @op-nx/github-cache:test --skip-nx-cache` | `Test Files 38 passed (38)`, `Tests 680 passed (680)` |
| `npm run typecheck -- --skip-nx-cache` | pass (`--skip-nx-cache` is not optional here: Phase 9 measured a stale `Cache: 2/2 hit` PASS after a spec-only edit) |
| `npm run lint -- --skip-nx-cache` | pass |
| `npm run format:check` | pass |
| `git diff --stat -- start-cache-server/index.js` | empty |

## User Setup Required

None -- no external service configuration required. The one thing worth LOOKING at rather
than configuring is coverage row D4: after the next default-branch push, read the `label`
field back off a freshly mirrored asset. Plan 10-01 measured it EMPTY on all 122 legacy
assets, so a non-empty value on a new one is unambiguous confirmation.

## Self-Check: PASSED

All four modified source files and this SUMMARY exist on disk. All four task commits
(`5c47111`, `21385b8`, `1b4bfbd`, `c555cb7`) are present in `git log --all`. This file is
ASCII-clean.
