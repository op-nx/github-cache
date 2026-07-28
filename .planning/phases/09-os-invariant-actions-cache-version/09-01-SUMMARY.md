---
phase: 09-os-invariant-actions-cache-version
plan: 01
subsystem: infra
tags: [nx, nx-target-defaults, task-hashing, vitest, cache-invalidation]

# Dependency graph
requires:
  - phase: 08-nx-task-hash-parity
    provides: 'the merged-configuration guard technique (`readTargetDefaultsForTarget` + `mergeTargetConfigurations` with a NEGATIVE vacuity control) and the NF-02 finding that `packages/github-cache/project.json` exists and can replace an inputs list wholesale'
  - phase: 07-lint-toolchain-and-the-ambient-platform-read-ban
    provides: '`nx-target-inputs.spec.ts` itself, the literal-pin form for `{workspaceRoot}` entries, and the two-shipped-false-pass enumeration this plan extends'
provides:
  - '`{workspaceRoot}/.github/workflows/ci.yml` is an explicit `nx.json` `targetDefaults.test.inputs` entry, effective on its own commit, so a `ci.yml` edit busts the `test` hash'
  - 'a three-clause PARITY-08 guard (literal pin, merged-configuration assertion, negative vacuity control) proving the registration survives the configuration Nx actually hashes'
  - "the displaced comment lock recording the `{ env: 'CI' }` / O1 finding, the inputs-REPLACE-not-merge fact, the `project.json`-exists correction to Phase 8 D-12, the explicit-path-over-glob choice, and the ordering reason"
affects:
  [
    09-05 dogfood-cross-os,
    09-06 docs-same-os-claims,
    any later plan asserting on ci.yml content,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'merged-configuration guard transplanted from `integration` to a target with an ABSENT `project.json` key and a THREE-layer merge'
    - 'a vacuity control that is itself non-vacuous: exact equality beside the `not.toContain`, so an empty/absent `inputs` cannot pass it'

key-files:
  created: []
  modified:
    - nx.json
    - packages/github-cache/src/nx-target-inputs.spec.ts

key-decisions:
  - 'Explicit file path over a `{workspaceRoot}/.github/workflows/**` glob, following the `start-cache-server/` precedent: the glob is equivalent today (two files) but would silently adopt whatever lands in the directory next.'
  - 'Clause 3 carries a second assertion (`toEqual([''default''])`) beside the required `not.toContain`, because `not.toContain` alone would also pass on an empty or absent merged `inputs` -- the exact "passes because nothing resolved" shape the file''s glob probes already guard against.'
  - 'Recorded ONE falsified locked decision (Phase 8 D-12), not two. The plan paired it with Phase 7 D-02; that attribution is wrong and writing it verbatim would have put a false record into the guard whose purpose is preventing false records.'
  - '`npm run check:action` is not runnable inside a node_modules-junctioned worktree -- it reports 689/689 path-identity drift. Proved byte-equivalence after normalizing the `../../../node_modules/` prefix instead, and restored the committed bundle.'

patterns-established:
  - 'Transplanting a merged-config guard across targets requires auditing the merge SHAPE, not just renaming the target: an absent project-layer key makes the higher-priority argument `{}`, which is precisely the state in which a broken merge is indistinguishable from a plain `targetDefaults` read.'
  - 'A false-pass incident enumeration lives in exactly ONE comment; later pins extend that sentence and point back to it rather than copying the list.'

requirements-completed: [PARITY-08]

coverage:
  - id: D1
    description: '`{workspaceRoot}/.github/workflows/ci.yml` is an explicit entry in `nx.json` `targetDefaults.test.inputs`, so every `ci.yml` edit re-runs `test`'
    requirement: PARITY-08
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/nx-target-inputs.spec.ts#nx.json declares ci.yml as a test input'
        status: pass
      - kind: other
        ref: 'npx nx run @op-nx/github-cache:test --skip-nx-cache (exit 0); `npm run test` reported 0/1 cache hit immediately after the nx.json edit, which is the hash rotation itself'
        status: pass
    human_judgment: false
  - id: D2
    description: 'The registration is pinned against the MERGED configuration (Nx''s own `readTargetDefaultsForTarget` + `mergeTargetConfigurations`), not `nx.json` alone, so a `project.json` `inputs` list cannot silently replace it behind a green test'
    requirement: PARITY-08
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/nx-target-inputs.spec.ts#keeps the ci.yml entry once project.json is merged over targetDefaults'
        status: pass
      - kind: other
        ref: 'STEP 6 mutation: a throwaway `"test": { "inputs": ["default"] }` in packages/github-cache/project.json reddened ONLY this clause; literal pin stayed green; reverted before staging'
        status: pass
    human_judgment: false
  - id: D3
    description: 'The merged-configuration assertion has a NEGATIVE vacuity control: a hostile LOCAL project-layer copy declaring `inputs: [''default'']` DROPS the entry, proving the merge consulted the project layer'
    requirement: PARITY-08
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/nx-target-inputs.spec.ts#DROPS the ci.yml entry when project.json declares its own test inputs, proving the merge merges'
        status: pass
    human_judgment: false
  - id: D4
    description: 'The comment lock displaced into the guard spec records all five facts strict JSON cannot hold, including the previously unrecorded `{ env: ''CI'' }` / O1 consequence at Nx 23.1.0'
    requirement: PARITY-08
    verification: []
    human_judgment: true
    rationale: 'Prose completeness and accuracy is a reading judgment. The five facts are individually verifiable (the `{ env: ''CI'' }` citation and the 23.1.0 version were re-measured during execution; `7413363` was confirmed via git log) but "the lock is complete and would stop the cleanup it exists to stop" is not assertable.'
  - id: D5
    description: '`integration`''s `{ "runtime": "node -p process.platform" }` is byte-identical and no other `nx.json` key changed (Phase 8 D-14, CORR-04)'
    requirement: PARITY-08
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/nx-target-inputs.spec.ts#integration declares exactly the byte-identical discriminator command (pre-existing, unmodified)'
        status: pass
      - kind: other
        ref: 'git diff --stat HEAD~1 HEAD -- nx.json => 1 insertion, 0 deletions'
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-28
status: complete
---

# Phase 9 Plan 01: `ci.yml` as a `test` Input Summary

**`{workspaceRoot}/.github/workflows/ci.yml` registered as a `test` input and pinned three ways -- literal, merged-configuration, and a negative vacuity control observed RED under a real `project.json` override -- so no later spec in this phase can assert on a replayed `ci.yml`.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-28T18:28Z
- **Completed:** 2026-07-28T18:40Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- One line in `nx.json`: `{workspaceRoot}/.github/workflows/ci.yml` beside the existing `cleanup.yml` entry, so a `ci.yml` edit busts the `test` hash. Effective on its own commit -- `{workspaceRoot}/nx.json` is already a `test` input, and `npm run test` duly reported `0/1 hit` right after the edit.
- A three-clause PARITY-08 guard in `nx-target-inputs.spec.ts` (`+158` lines, mostly the comment lock). Clause 2 reads the configuration Nx actually hashes via Nx's own two merge functions; clause 3 proves the merge consulted the project layer.
- Clause 2 was **observed RED before being trusted** (STEP 6), with clause 1 staying GREEN -- the split that is the entire reason clause 2 exists.
- The comment lock now carries the `@nx/vitest` `{ env: 'CI' }` finding and its consequence: an inferred-input `test` target makes O1 structurally impossible, so the milestone's headline outcome currently holds *by accident* of a decision taken for another reason. Nothing in the repo recorded that before this commit.

## Task Commits

1. **Task 1: Register the entry and pin it against the merged configuration** - `884e231` (test)

**Plan metadata:** see the `docs(09-01)` commit that follows this file.

## Files Created/Modified

- `nx.json` - one added string in `targetDefaults.test.inputs`; `git diff --stat` shows `1 insertion(+)` and nothing else. `targetDefaults.integration.inputs` still carries `{ "runtime": "node -p process.platform" }` byte-identically.
- `packages/github-cache/src/nx-target-inputs.spec.ts` - new `describe('ci.yml is a test input, so no spec can assert on a replayed ci.yml (PARITY-08)')` block with three `it`s and the displaced comment lock; plus a six-line extension of the existing `eslint.config.mjs` pin's false-pass enumeration so the two shipped incidents stay listed in exactly one place.

## STEP 6 -- proving clause 2 can fail

Applied a throwaway `"test": { "inputs": ["default"] }` target block to `packages/github-cache/project.json` (the file has no `test` key, so a whole block was added rather than a field), then ran the spec:

```
✓ ... (PARITY-08) > nx.json declares ci.yml as a test input 0ms
× ... (PARITY-08) > keeps the ci.yml entry once project.json is merged over targetDefaults 3ms
  → expected [ 'default' ] to include '{workspaceRoot}/.github/workflows/ci.…'
✓ ... (PARITY-08) > DROPS the ci.yml entry when project.json declares its own test inputs, proving the merge merges 0ms

 Test Files  1 failed (1)
      Tests  1 failed | 23 passed (24)
```

Failure located at `src/nx-target-inputs.spec.ts:653:63`. **Exactly one clause reddened** -- the merged-configuration one. The literal pin stayed green (it reads `nx.json`, which was untouched), and the negative control stayed green (it merges a LOCAL hostile copy and is indifferent to what is on disk). Three guards, one blind spot, reproduced on demand.

Reverted with `git checkout -- packages/github-cache/project.json`; `git diff --exit-code -- packages/github-cache/project.json` empty, then re-ran: 24/24 green. `project.json` is absent from `git diff --name-only 4296d1d HEAD`.

## Verification

| Command | Result |
|---|---|
| `npx nx run @op-nx/github-cache:test --skip-nx-cache` | PASS -- 34 files / 577 tests |
| `npm run format:check` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run typecheck:action` | PASS (exit 0) |
| `npm run test` | PASS -- `Cache: 0/1 hit`, i.e. the `nx.json` edit rotated the `test` hash |
| `npm run fallow:ci` | PASS -- `No issues found`, 53 entry points |
| `npm run pack:check` | PASS -- 53 files, no internals leaked |
| `npm run check:action` | NOT RUNNABLE in this worktree -- see Issues. Byte-equivalence proved by normalization instead; `git diff --exit-code -- start-cache-server/index.js` is clean at the commit. |

Scope: `git diff --name-only 4296d1d HEAD` returns exactly `nx.json` and `packages/github-cache/src/nx-target-inputs.spec.ts`. Nothing under `src/lib/` or `src/backend/`. No spec in this plan reads `.github/workflows/ci.yml`.

## Decisions Made

- **Explicit path, not a glob.** `.github/workflows/` holds only `ci.yml` and `cleanup.yml`, so `{workspaceRoot}/.github/workflows/**` would be equivalent *today* -- and would silently adopt whatever lands there next. Same call `start-cache-server/` already got in this list (`action.yml` + `entry.ts` named individually, because the directory also holds the generated `index.js` bundle).
- **Clause 3 got a second assertion.** `not.toContain` alone also passes if the merged `inputs` comes back empty or absent, which is the same "passes because nothing was resolved" shape this file's glob probes exist to guard against -- in the *vacuity control itself*. `toEqual(['default'])` states the actual mechanism: the project layer REPLACED the list, it did not filter one entry out of it.
- **One falsified locked decision recorded, not two.** See Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's `project.json` correction misattributed one of its two decisions**

- **Found during:** Task 1, STEP 5 (the comment lock)
- **Issue:** The plan (and D-24's corollary) instructed recording that "Phase 8's D-12 and Phase 7's D-02 both assert this workspace is free of `project.json` and that premise is FALSE". Phase 8's D-12 does say exactly that (`08-CONTEXT.md:111` -- "No `project.json` (the workspace is deliberately free of them)"). **Phase 7's D-02 does not.** `07-CONTEXT.md:48-54` D-02 is about the five exact-pinned root devDependencies. The Phase 7 decision that mentions the file is **D-01** (`:35-46`), and it describes it CORRECTLY -- "beside the existing `integration` target in `packages/github-cache/project.json`". Writing the plan's sentence verbatim would have placed a verifiably false claim inside the one comment block whose entire purpose is preventing false records from being carried forward.
- **Fix:** Lock fact 4 records that ONE locked decision is falsified (D-12), names the misattribution explicitly, and points at Phase 7 D-01 as the accurate reference. `7413363` was confirmed as the tracking commit via `git log -1 -- packages/github-cache/project.json`.
- **Files modified:** `packages/github-cache/src/nx-target-inputs.spec.ts`
- **Verification:** Both cited decisions read in full at `.planning/phases/08-nx-task-hash-parity/08-CONTEXT.md:111-112` and `.planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-CONTEXT.md:35-54`.
- **Committed in:** `884e231`

**2. [Rule 3 - Blocking] `npm run check:action` reports false drift inside a node_modules-junctioned worktree**

- **Found during:** Task 1, verification battery
- **Issue:** The plan's `<verification>` requires all nine battery commands green, including `npm run check:action` (`build:action` + `git diff --exit-code -- start-cache-server/index.js`). Run in this worktree it **rebuilds** the bundle and reports `689 insertions(+), 689 deletions(-)`. Cause: the worktree shares the main tree's `node_modules` via a Windows junction (per AGENTS.md, valid because this plan touches neither `package.json` nor the lockfile), so esbuild resolves dependencies through the junction and emits `../../../node_modules/...` where the committed bundle has `node_modules/...` -- in both its path comments and its `__commonJS` module-registry keys. This is an artifact of *where* the build ran, and this plan touches no `serve()`-reachable file at all.
- **Fix:** Did not chase the drift and did not commit a rebuilt bundle. Proved equivalence directly instead: normalized `(\.\./)+node_modules/` -> `node_modules/` in both `git show HEAD:start-cache-server/index.js` and the rebuilt file and compared -- **identical after path normalization: true** (2,470,630 vs 2,476,831 bytes, the delta being exactly the added prefixes). Then `git checkout -- start-cache-server/index.js`, confirmed `git diff --exit-code` clean, and removed the throwaway script. The bundle is byte-identical to `4296d1d` in the commit.
- **Files modified:** none (`start-cache-server/index.js` restored to its committed state)
- **Verification:** `git status --short` before staging showed only the two planned files; `git diff --name-only 4296d1d HEAD` confirms it.
- **Committed in:** n/a (no file change)
- **Note for the orchestrator:** run `npm run check:action` on the main tree post-merge for a true signal. It cannot produce one from a junctioned worktree.

---

**Total deviations:** 2 auto-fixed (1 bug in the plan's own record, 1 blocking tooling incompatibility)
**Impact on plan:** No scope change. Deviation 1 makes the comment lock true rather than merely compliant; deviation 2 avoided committing a 1378-line junction artifact into the action bundle.

## Issues Encountered

- **`check:action` in a junctioned worktree** -- see Deviation 2. Worth remembering beyond this plan: the project's existing rule is "editing a `serve()`-reachable source drifts `start-cache-server/index.js`, so regenerate it in the SAME commit". The inverse also holds and is more dangerous, because it looks identical: *running the build in a junctioned worktree drifts the bundle with no source edit at all*. An executor that trusted `check:action`'s verdict here would have committed 689 rewritten module keys as if they were its own work.
- **Nothing else.** No auth gates, no checkpoints, no architectural decisions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Unblocked:** 09-05 (`dogfood-cross-os.spec.ts`) and 09-06 (`docs-same-os-claims.spec.ts`) can now assert on `ci.yml` content without their verdicts being replays. The entry is live as of `884e231` -- there is no window to work around.
- **Still open for a later plan/audit:** the same registration gap could exist for other cross-target files. This plan closed `ci.yml` for `test` only, which is the whole of PARITY-08 and deliberately not more.
- **Carry forward:** `npm run check:action` must be run on the main tree, not in a junctioned worktree.

## Self-Check: PASSED

- `nx.json` -- FOUND, contains `{workspaceRoot}/.github/workflows/ci.yml`
- `packages/github-cache/src/nx-target-inputs.spec.ts` -- FOUND, contains the PARITY-08 describe block with three `it`s
- `packages/github-cache/project.json` -- FOUND, unmodified (absent from the branch diff)
- `start-cache-server/index.js` -- FOUND, unmodified (`git diff --exit-code` clean)
- Commit `884e231` -- FOUND in `git log`

---
*Phase: 09-os-invariant-actions-cache-version*
*Completed: 2026-07-28*
