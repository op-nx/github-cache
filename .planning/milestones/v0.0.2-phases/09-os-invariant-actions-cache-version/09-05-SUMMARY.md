---
phase: 09-os-invariant-actions-cache-version
plan: 05
subsystem: ci-proof
status: complete
tags:
  - ver-06
  - cross-os
  - dogfood
  - provenance
  - vacuity-guard
  - workflow-drift-guard
requires:
  - 09-01 # {workspaceRoot}/.github/workflows/ci.yml as a `test` input (nx.json:69) -- without it this plan's ci.yml guard replays a stale cached PASS
  - 09-03 # CACHE_ARCHIVE_DIR + enableCrossOsArchive at all three call sites -- the behaviour this plan proves
  - 09-04 # FILE SERIALIZATION only (shared action/index.ts + action/index.spec.ts), not a logical dependency
provides:
  - dogfoodBody(hash, producerOs) # required producer-OS parameter folded into the payload bytes
  - dogfood-cross-os.spec.ts # ci.yml drift guard: dogfood-verify two-leg matrix, dogfood-seed single-leg
  - dogfood-verify two-leg matrix # [ubuntu-24.04-arm, windows-11-arm], fail-fast: false, timeout-minutes: 20
affects:
  - packages/github-cache/src/lib/dogfood-body.ts
  - packages/github-cache/src/action/index.ts
  - packages/github-cache/src/roundtrip/read-back.ts
  - .github/workflows/ci.yml
tech-stack:
  added: [] # no new npm package, no new third-party action
  patterns:
    - A1a-inverted # comment-locked single-source leaf WITHOUT the injectable-platform default (D-18 forbids it)
    - A6 # two-leg OS matrix job, copied from the integration job header
    - comment-stripped-workflow-scan # cleanup-workflow.spec.ts:16-20 idiom, scoped per job block
    - pinned-literal # hand-authored payload literal, not reconstructed via dogfoodBody(...)
    - structural-arity-assertion # selectBackend.length precedent, applied to dogfoodBody.length
key-files:
  created:
    - packages/github-cache/src/dogfood-cross-os.spec.ts
  modified:
    - packages/github-cache/src/lib/dogfood-body.ts
    - packages/github-cache/src/lib/dogfood-body.spec.ts
    - packages/github-cache/src/action/index.ts
    - packages/github-cache/src/action/index.spec.ts
    - packages/github-cache/src/roundtrip/read-back.ts
    - .github/workflows/ci.yml
decisions:
  - D-18 implemented with a structural arity assertion, upgrading the no-default rule from review-enforced to test-enforced
  - D-19 implemented by moving the single call into each branch (per C-01), not by a conditional above it
  - action/index.spec.ts's payload literal strengthened so it actually gates the template (measured gap, not planned)
metrics:
  duration: ~35 min
  completed: 2026-07-28
  tasks: 3
  commits: 1
  tests_before: 635 across 35 files
  tests_after: 640 across 36 files
requirements: [VER-06]
---

# Phase 09 Plan 05: Cross-OS Proof with a Real Windows Runner Summary

The dogfood payload now carries the OS that produced it, `dogfood-verify` samples both
Linux and Windows, and the vacuity trap that would let that job pass while proving
nothing has been triggered on purpose and caught.

## What Was Built

VER-06's claim is that an Actions-cache entry saved on Linux is readable on Windows. A
spec runs in one process on one OS and cannot observe that, so the load-bearing control
is a CI job -- and the obvious version of that job passes vacuously. The seed key is
`nx-cache-<GITHUB_RUN_ID>`: **one key per RUN, not per OS**. So a presence-only check on
the Windows leg would go green the moment anyone added a Windows seed leg, even with
cross-OS restore completely dead. Four things close that:

**1. Provenance in the bytes.** `dogfoodBody(hash: string, producerOs: CacheOs)` takes a
REQUIRED second parameter with no default, folded into the payload as
`nx-github-cache-dogfood:<producerOs>:<hash>`. `CacheOs` is imported `import type` so
the module stays a runtime leaf. The doc block comment-locks three things: why there is
no default (contrasted with `releaseAssetName(hash, platform = process.platform)`, whose
default is correct there and would be actively wrong here), why the value must reach the
BYTES rather than merely sit in the signature, and that the template is pinned in two
files by design.

**2. Two call sites that cannot converge.** The single pre-branch call was moved INTO
each branch: the seed branch passes `cachePlatform()` (an ambient read, legitimate in a
bin -- LINT-02's ban is scoped to spec files), and the verify branch passes the literal
`'linux'`. A comment where the old call sat states that hoisting them back together
reintroduces the one-expression coupling that makes the trap reachable.

**3. A two-leg matrix with the vacuity condition in the workflow.** `dogfood-verify`
gained `strategy.fail-fast: false`, `matrix.os: [ubuntu-24.04-arm, windows-11-arm]`,
`runs-on: ${{ matrix.os }}`, and the `timeout-minutes: 20` it never had. `dogfood-seed`
is untouched apart from nothing -- still single-leg, still `runs-on: ubuntu-24.04-arm`.
The extended job comment carries the vacuity condition, why the ubuntu leg is kept
rather than traded away, that a MISS fails loudly, and that a green `dogfood-verify` is
NOT ROBUST-04 evidence.

**4. A drift guard that makes the trap structurally unreachable.**
`dogfood-cross-os.spec.ts` reads `ci.yml` via `import.meta.url`, strips `#`-prefixed
lines, and asserts both halves of the shape scoped PER JOB BLOCK.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `action/index.spec.ts`'s payload literal gated nothing**

- **Found during:** Task 3, mutation M1
- **Issue:** M1 (drop `producerOs` from the bytes) reddened only
  `dogfood-body.spec.ts`. `action/index.spec.ts` stayed entirely green, because the test
  holding the hand-authored literal asserts only `setSecret` -- it never checks whether
  the verify branch accepted those bytes. So the literal documented the template but
  gated nothing, which made both the plan's "pinned in two files" premise and my own
  freshly written doc-block claim false.
- **Fix:** added `expect(core.setFailed).not.toHaveBeenCalled()` and
  `expect(core.info).toHaveBeenCalledWith(expect.stringContaining('cache HIT'))` to that
  test, with a comment recording the measurement. Re-ran M1: it now reddens BOTH files.
- **Files modified:** `packages/github-cache/src/action/index.spec.ts`
- **Commit:** `1b94ab3`

**2. [Rule 2 - Missing critical functionality] the no-default rule would have been review-enforced only**

- **Found during:** Task 1
- **Issue:** the plan anticipated (correctly) that M2 reddens nothing, because both call
  sites pass an explicit argument, and asked for a `Function.length` assertion "if cheap".
- **Fix:** added `expect(dogfoodBody.length).toBe(2)` in the RED spec, following
  `select-backend.spec.ts:298`'s `selectBackend.length` precedent. `Function.length`
  counts parameters before the first default, so a default drops it to 1. D-18's rule is
  now test-enforced rather than a named residual.
- **Commit:** `1b94ab3`

### Plan Inaccuracies Corrected (not code changes)

These are stale line numbers and miscounts in the plan text. Recorded so plan 09-07 and
the verifier do not re-derive them.

| Plan claim | Measured reality |
|---|---|
| `dogfoodBody` call at `action/index.ts:224`, branches at `:233`/`:253` | `:265`, branches at `:274`/`:294` before this plan -- plan 09-04 shifted them. The plan's own C-01 correction (one call, before both branches) was accurate; only the numbers drifted. |
| `action/index.spec.ts:165-213` has **three** hand-authored `'nx-github-cache-dogfood:run-1'` literals | Exactly **ONE**, at `:221`. The other two verify tests use `null` (404) and `'wrong-bytes'`. `git grep` over all tracked files confirms one occurrence outside `dogfood-body.ts`. |
| `git grep -c "dogfoodBody" -- action/index.ts` should return 2 | Returns **4**. `git grep -c` counts LINES containing the string: the import, the explanatory comment, and the two calls. The substance holds -- `git grep -n "dogfoodBody("` shows exactly two calls, at `:286` (inside the seed branch at `:281`) and `:329` (inside the verify branch at `:307`), and none before `:281`. The criterion's instrument was wrong, not its intent. |
| `dogfood-verify` at `ci.yml:817-836`, `:818-819` the sentence to extend | Accurate. |

## TDD Gate Compliance

**There is no separate `test(09-05): ...` RED commit, and that is deliberate -- flagging
it rather than letting the gate scanner discover a gap.**

The execution prompt stated "this plan has no one-commit constraint, so follow the normal
RED->GREEN sequence". That is not what the plan says: Task 1 and Task 2 both end in
**DO NOT COMMIT**, and Task 3's acceptance criterion is "Exactly ONE commit contains the
seven paths". The plan's constraint was followed, for the reason the phase applies
elsewhere (C-03: "the guard and its spec accommodation must be ONE commit"): a RED-only
commit here is a commit where `npm run test` fails with 3 red tests AND `npm run typecheck`
fails with 9 x TS2554, because the two-argument spec calls do not compile against the
one-parameter signature. Splitting would put a knowingly broken tree in history.

The gate's SUBSTANCE was satisfied -- RED was observed before implementation, and
recorded below.

### RED was ASSERTION-LEVEL, not an import failure

This distinction is the recorded lesson from plan 09-04. Every new assertion was
evaluated and failed on its own merits; the suite ran to completion (637 passed alongside
the 3 failures, 640 collected), so this is not a whole-file import error masquerading as
RED.

| Failing test | Verbatim failure |
|---|---|
| `dogfood-body.spec.ts > returns different bytes for different producer OSes -- the provenance claim (VER-06, D-18)` | `AssertionError: expected true to be false // Object.is equality` |
| `dogfood-body.spec.ts > structural: dogfoodBody.length is 2 -- neither parameter carries a default (D-18)` | `AssertionError: expected 1 to be 2 // Object.is equality` |
| `dogfood-cross-os.spec.ts > dogfood-verify samples BOTH OSes with fail-fast off, ...` | `AssertionError: expected '    if: github.event_name == \'push\'...' to match /strategy:\s*\n\s*fail-fast:\s*false/` |

Typecheck RED: 9 x `error TS2554: Expected 1 arguments, but got 2` in
`dogfood-body.spec.ts`.

Note which Task 1 clauses were GREEN at RED time and why that is correct: the
`dogfood-seed` no-matrix clause and the non-empty-extraction control both passed, because
`dogfood-seed` genuinely has no matrix today. Only M3 could redden the former.

## Mutation Testing (Task 3)

Each mutation applied, OBSERVED, reverted, and green reconfirmed. `git diff` at the end
of Task 3 showed no mutated state persisted.

**M1 -- `producerOs` not in the bytes** (accept the parameter, `void` it, return the old
payload). Purpose: prove D-18 is behavioural, not cosmetic.

- First run: **1 test red** -- `returns different bytes for different producer OSes`,
  `AssertionError: expected true to be false`. `action/index.spec.ts` stayed green, which
  exposed the gap fixed as deviation 1 above.
- After the fix, re-run: **2 tests red** -- the above, plus
  `action/index.spec.ts > masks the bearer token with setSecret before driving any request (T-2-19)`
  with `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times`.
  The two-file pin is now real rather than asserted.

**M2 -- a default value on `producerOs`** (`= cachePlatform()`). Purpose: establish
honestly whether the no-default rule is test-enforced.

- **1 test red** --
  `structural: dogfoodBody.length is 2 -- neither parameter carries a default (D-18)`,
  `AssertionError: expected 1 to be 2 // Object.is equality`.
- **Honest reading:** the plan predicted M2 reddens nothing, and that prediction was
  correct about the plan's own spec set -- M2 changes no BEHAVIOUR reachable from either
  call site, since both pass an explicit argument. The redness comes entirely from the
  structural arity assertion added in Task 1 for exactly this purpose. So the rule IS
  test-enforced, but by a structural assertion rather than a behavioural one. **No named
  residual remains for D-18.**

**M3 -- a matrix on `dogfood-seed`** (`strategy.matrix.os` with both runners plus
`runs-on: ${{ matrix.os }}`). This is the vacuity trap itself.

- **1 test red** -- `dogfood-seed stays SINGLE-LEG -- a Windows seed leg would make the whole proof vacuous`,
  with the message verbatim:

  > `dogfood-seed must stay single-leg (ubuntu-only). The seed key is nx-cache-<GITHUB_RUN_ID> -- ONE key per RUN, not per OS -- so a Windows seed leg makes the Windows dogfood-verify leg restore a WINDOWS-written entry and pass even if cross-OS restore is completely broken. That turns VER-06 into a presence check.: expected '    if: github.event_name == \'push\'...' not to match /strategy:/`

  The trap was triggered on purpose and caught, with the reason in the failure output.

## Open Items

### `human_needed` -- VER-06's live clause (merge-gated, NOT closed here)

**This plan closes the code and the workflow text. It does NOT close the live
observation, and no acceptance check in it can.** `ci.yml:3-7` filters pushes to `main`,
and both dogfood jobs are `if: github.event_name == 'push'`, so neither runs on this
branch or on a pull request (C-06). The fixture RED was achievable; the live RED was not.

- **Where it will be read:** the first push to `main` after this branch merges, in the CI
  run's `dogfood-seed` job followed by both `dogfood-verify` matrix legs.
- **What closes it:** `dogfood-seed` (ubuntu, single leg) green, then BOTH
  `dogfood-verify` legs green -- specifically the `windows-11-arm` leg. A MISS or a
  byte-mismatch calls `core.setFailed`, so a green Windows leg IS the proof; no log
  reading is required beyond confirming both legs actually ran. The confirming log line
  is `github-cache dogfood verify: cache HIT for <run_id> on windows with bytes matching
  a 'linux'-produced payload.`
- **Carried into:** plan 09-07's `09-EVIDENCE.md` `## Live-CI closures` section.
- **If the Windows leg goes RED, that is a REAL RESULT, not a setup problem.** The runner
  combination is already proven in-repo (`publish` runs `npm ci` + `npm run build` +
  `uses: ./packages/github-cache` on `windows-11-arm` today). The MISS message names both
  hypotheses so the failure is diagnosable: cross-OS extraction failing versus the archive
  version still differing.

### A green `dogfood-verify` is NOT ROBUST-04 evidence

Both dogfood jobs run `uses: ./packages/github-cache`, whose `dist/action/index.js` is
built from source in-job. They never execute the committed
`start-cache-server/index.js`, which is what four of the five bundle sites run.
`action-bundle-drift` (no `if:`, so it runs on PRs) is the only control tying them
together. Recorded in the workflow comment as well as here, because the misreading is
natural.

## Verification

All NINE battery commands exit 0 at the committed tree:

| Command | Result |
|---|---|
| `npm run format:check` | pass |
| `npm run build` | pass |
| `npm run typecheck` | pass |
| `npm run typecheck:action` | pass |
| `npm run test` | 640 passed, 36 files |
| `npm run lint` | pass |
| `npm run fallow:ci` | `No issues found`, 55 entry points |
| `npm run check:action` | pass, **EMPTY diff** |
| `npm run pack:check` | pass, 55 files, no internals leaked |

**`check:action` was VERIFIED, not assumed.** `dogfood-body.ts` is imported only by
`action/index.ts` and `read-back.ts`, neither of which the bundle's single entry
(`start-cache-server/entry.ts`) reaches -- so `start-cache-server/index.js` is unmodified
by this plan and is not in the commit. `npm ci` was used rather than a junctioned
`node_modules`, so the esbuild path-rewrite artefact measured in plan 09-01 does not
apply and the empty diff is meaningful.

Test count moved 635/35 files -> 640/36 files: +1 file (`dogfood-cross-os.spec.ts`, 3
tests) and +2 tests in `dogfood-body.spec.ts` (the two-OS provenance test and the
structural arity test). No regression.

Invariants confirmed by `git show --stat HEAD` (7 files) and `git diff`:

- `public-surface.spec.ts`, `src/index.ts`, `src/test/consumer-contract.ts` UNMODIFIED
  (PARITY-07) -- `dogfoodBody` is not in the barrel.
- `publish/publish-mirror.ts` untouched.
- `read-back.ts` `:10-31` and `:52-56` unmodified (Phase 10 owns them); the only changes
  are the added import and the `:62` call plus its comment.
- `ci.yml`'s `integration` job comment and `publish` matrix comment byte-unchanged -- the
  whole `ci.yml` diff is confined to the `dogfood-verify` block (plan 09-06 owns the
  other two).
- `dogfood-seed` byte-unchanged, still `runs-on: ubuntu-24.04-arm`, no matrix.
- `git diff --diff-filter=D HEAD~1 HEAD` -- no deletions.
- No `git stash`, no `git clean`, no `git reset` used at any point.

## Self-Check: PASSED

Created file exists:

- `packages/github-cache/src/dogfood-cross-os.spec.ts` -- FOUND

Commit exists:

- `1b94ab3` -- FOUND (`feat(09-05): prove cross-OS restore with a Windows runner (VER-06)`, 7 files, 298 insertions)

Working tree clean after the commit; the only subsequent write is this SUMMARY.
