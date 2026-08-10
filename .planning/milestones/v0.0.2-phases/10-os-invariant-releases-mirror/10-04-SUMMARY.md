---
phase: 10-os-invariant-releases-mirror
plan: 04
subsystem: infra
tags: [github-actions, cache-keys, provenance, vitest, tdd, obs-05]

# Dependency graph
requires:
  - phase: 10-02
    provides: the `mirrored-by` label seam, which is what will let OBS-05's read-back side distinguish a dead publish leg by PUBLISHER as well as by key
  - phase: 09-os-invariant-actions-cache-version
    provides: VER-06's vacuity lesson and the no-hoist lock above the seed/verify branches, which is the reason this branch builds its own url
provides:
  - "`mirrorSeedHash(runId, os)` in a new pure leaf `lib/mirror-seed.ts` -- `feed<CACHE_OS_VALUES index><runId>`, one helper for both call sites and no hash arithmetic in YAML (D-14)"
  - a third sibling `mirror-seed` operation on the internal dogfood action that PUTs at the DERIVED seed and stores `dogfoodBody(<derived seed>, <this leg's OS>)`
  - the url-reuse trap closed by a test whose path assertion a substring match provably cannot satisfy
  - an unknown-operation failure message that names all three operations, asserted for the first time
affects: [10-05 read-back tightening, CORR-02 asset rename, 10-VERIFICATION, 10-SECURITY]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A hex-word marker plus a tuple index as a run-scoped key namespace, following ci.yml consumer-smoke's shipped `cafe<run_id>` precedent with a DIFFERENT word"
    - "`Record<CacheOs, string>` for pinned per-OS literals, so a fourth tuple member is a TYPE error rather than an unsampled leg"
    - "Asserting a request's final PATH SEGMENT, never `toContain(<id>)`, when the expected value CONTAINS the wrong value"
    - "A RED scaffold that encodes today's contract, so a brand-new module's first failure is assertion-level rather than module-not-found"

key-files:
  created:
    - packages/github-cache/src/lib/mirror-seed.ts
    - packages/github-cache/src/lib/mirror-seed.spec.ts
  modified:
    - packages/github-cache/src/action/index.ts
    - packages/github-cache/src/action/index.spec.ts
    - packages/github-cache/action.yml
    - packages/github-cache/src/docs-same-os-claims.spec.ts

key-decisions:
  - "Encoding is `feed<index><runId>` -- RESEARCH's recommended form, taken over CONTEXT's terser `e2<run_id>` for legibility beside the shipped `cafe<run_id>` family"
  - "The OS index is single-sourced from the REAL tuple at RUNTIME (`CACHE_OS_VALUES.indexOf(os)`), which is the one thing that differs from the `dogfood-body.ts` analog's type-only edge"
  - "A separate leaf rather than a fold into `release-asset-name.ts`: provably unreachable from `serve()`, so the bundle delta is ZERO and the whole ROBUST-04 obligation stays on plan 10-07"
  - "`cachePlatform()` is bound ONCE inside the branch, not above it. The no-hoist lock bans a conditional above the branches, not a branch-local binding, and one binding is what makes 'the key and the body name the same leg' a single fact"
  - "The action spec's URL expectation is DERIVED from `mirrorSeedHash`; the hand-authored literals live in `mirror-seed.spec.ts`. The two files answer different mutations and duplicating the literals would pin nothing extra"

patterns-established:
  - "Pinned literal AND tuple-derived check as COMPLEMENTS, with the split stated: the literal catches a marker change and a slot reordering, the derived check catches an index that stopped coming from the tuple (a hardcoded 0/1/2 mapping satisfies every literal)"
  - "Quoting both sides of an enumerated name in a message assertion (`'seed'`, not `seed`) because a bare token is a substring of a sibling token"
  - "Proving an assertion is non-vacuous by WEAKENING it with the mutation still live, and showing the suite goes green"

requirements-completed: []

coverage:
  - id: D1
    description: "`mirrorSeedHash` derives the exact pinned seed for every `CACHE_OS_VALUES` member, with the OS slot taken from the real tuple index"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/mirror-seed.spec.ts#mirrorSeedHash (OBS-05 per-leg publish seed, D-12) > derives exactly the pinned seed on a %s leg"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/mirror-seed.spec.ts#mirrorSeedHash (OBS-05 per-leg publish seed, D-12) > takes the OS slot digit from the REAL CACHE_OS_VALUES index for %s"
        status: pass
    human_judgment: false
  - id: D2
    description: "The seed is disjoint from all FOUR competing spaces: it is representable as a cache hash, contains a hex letter (so no all-decimal run id or Nx task hash can equal it), takes its OS component from the real tuple, and does not belong to the shipped `cafe<run_id>` family"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/mirror-seed.spec.ts#mirrorSeedHash (OBS-05 per-leg publish seed, D-12) > is representable as a cache hash on a %s leg -- the D-12 constraint a reader misses, since <run_id>-<os> is not"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/mirror-seed.spec.ts#mirrorSeedHash (OBS-05 per-leg publish seed, D-12) > contains a hex LETTER on a %s leg -- disjointness from run ids and Nx task hashes is STRUCTURAL, both spaces being all-decimal"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/mirror-seed.spec.ts#mirrorSeedHash (OBS-05 per-leg publish seed, D-12) > stays distinct from the cafe<run_id> seed ci.yml's consumer-smoke job already ships, on a %s leg"
        status: pass
    human_judgment: false
  - id: D3
    description: "The seeds are injective across the OS tuple, and the PRECONDITION that makes a single-digit index injective is pinned separately because the injectivity case cannot carry it"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/mirror-seed.spec.ts#mirrorSeedHash (OBS-05 per-leg publish seed, D-12) > derives a DISTINCT seed for every CACHE_OS_VALUES member -- injectivity, which is the whole point of the helper"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/mirror-seed.spec.ts#mirrorSeedHash (OBS-05 per-leg publish seed, D-12) > pins the PRECONDITION for that injectivity: CACHE_OS_VALUES holds under ten members"
        status: pass
    human_judgment: false
  - id: D4
    description: "The derived seed survives every validator on its path -- `parseHash`, `isServerProducedKey` on its cache key (so it IS enumerated and mirrored), and `releaseAssetName` -> `isServerProducedAssetName` via the one-argument form that survives CORR-02"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/mirror-seed.spec.ts#mirrorSeedHash (OBS-05 per-leg publish seed, D-12) > survives every validator on the seed path for a %s leg"
        status: pass
    human_judgment: false
  - id: D5
    description: "The `mirror-seed` branch PUTs at the DERIVED seed, never at the raw run id, and stamps the same leg into the body -- the url-reuse trap, asserted on the whole url and on the final path segment so a substring match cannot satisfy it"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/action/index.spec.ts#run() dogfood fail-loud canary (T-2-19, T-2-20) > the mirror-seed operation (OBS-05, D-12/D-13) > PUTs at the DERIVED seed on a %s leg, never at the raw run id, and stamps the same leg into the body"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/action/index.spec.ts#run() dogfood fail-loud canary (T-2-19, T-2-20) > the mirror-seed operation (OBS-05, D-12/D-13) > fails the job loud on a non-200 PUT, without throwing"
        status: pass
    human_judgment: false
  - id: D6
    description: "The unknown-operation failure message names all three valid operations, each checked by NAME rather than by whole sentence"
    requirement: "OBS-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/action/index.spec.ts#run() dogfood fail-loud canary (T-2-19, T-2-20) > names every valid operation when the operation input is unrecognised"
        status: pass
    human_judgment: false
  - id: D7
    description: "LIVE: the two `publish` legs write DIFFERENT seed keys on one default-branch push, and each leg's own seed asset appears in the shard as `nx-cache-feed<index><run_id>`"
    verification: []
    human_judgment: true
    rationale: "The mechanism exists and is proven machine-independently, but ci.yml is deliberately UNCHANGED by this plan (its `publish` job still runs `operation: seed`), so nothing exercises `mirror-seed` on real CI yet. Plan 10-05 flips the workflow and `read-back.ts` together as one atomic change; this row is observable only after that lands and pushes."

# Metrics
duration: 16min
completed: 2026-07-29
status: complete
---

# Phase 10 Plan 04: The Leg-Distinguishable Mirror Seed Summary

**Each `publish` leg can now derive a seed key only that leg can produce -- proven disjoint
from all four competing key spaces over the real OS tuple, proven to survive every
validator on its path, and PUT by a third sibling operation branch whose url-reuse trap is
closed by a test rather than by a comment.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-29T13:20Z
- **Completed:** 2026-07-29T13:36Z
- **Tasks:** 1 of 1
- **Files created:** 2. **Files modified:** 4.

## Accomplishments

- `lib/mirror-seed.ts` exports exactly one function: `mirrorSeedHash(runId, os)` returning
  `feed<CACHE_OS_VALUES index><runId>`. One helper, two intended call sites, no hash
  arithmetic in YAML (D-14). Its import list is one statement from a sibling leaf.
- **All FOUR disjointness axes asserted, not argued.** CONTEXT.md lists three; RESEARCH C-4
  supplies the fourth and it is the one that mattered -- see the next section.
- **The url-reuse trap is closed by a test, and the test is proven non-vacuous by
  experiment** rather than by reasoning. See "The url trap" below.
- **The `mirror-seed` branch is a THIRD SIBLING**, never a variant of `seed`. The
  prohibition is not cosmetic: `dogfood-seed`/`dogfood-verify` require ONE shared key per
  RUN, and seeding that key per OS is precisely the vacuity trap VER-06 closed.
- **The unknown-operation message is now asserted for the first time.** It had sat naming
  only two operations because nothing checked it -- exactly why the plan called it easy to
  leave stale.
- **Bundle delta ZERO, measured with a positive control.** `npm run build:action` was
  correctly not run.

## Task Commits

| Commit | Kind | What |
|--------|------|------|
| `9d4dde7` | test | RED -- both spec files plus the scaffold that makes the failures assertion-level |
| `f94a8ee` | feat | GREEN -- the derivation, the branch, `action.yml`, the message, the `EDITED_FILES` follow-through |
| `28ae2da` | fix | a comment-lock claim that the plan's own analytic mutation 4 proved false |

No REFACTOR commit: no duplicated literal appeared.

## Which kind of RED was achieved

**ASSERTION-LEVEL, and deliberately engineered to be.** `14 failed | 25 passed (39)` --
both spec files imported and 25 sibling cases executed and passed. Every failure printed a
VALUE comparison.

The interesting part is how, because a brand-new module's natural RED is
module-not-found -- an import-level whole-suite failure, which is exactly what the mode
flags forbid. So the RED commit also lands `mirror-seed.ts` as a **scaffold that encodes
today's contract**: it already single-sources the OS index from the real tuple (D-12
constraint 3) and is missing only the hex MARKER. That choice is what makes the RED
*informative* rather than merely non-import-level -- the 14 failures name precisely which
constraint is unmet:

| Failing group | Count | What the absence of the marker costs |
|---------------|-------|--------------------------------------|
| pinned per-OS literals | 3 | the exact key, spelled out |
| tuple-derived marker slot | 3 | the marker is not there to find the index after |
| hex LETTER | 3 | `2<run_id>` is all-decimal, so it is NOT disjoint from a run id or an Nx task hash |
| `mirror-seed` branch PUT (it.each) | 3 | `fetch` was never called -- no branch exists |
| non-200 PUT setFailed | 1 | same |
| unknown-operation message | 1 | the message names two operations, not three |

Cases that passed under the scaffold and are therefore NOT what the RED proves:
`HASH_PATTERN` (a run id is already valid hex), the `cafe` disjointness clauses, injectivity
(the index alone separates the legs), the validator round-trip, the `Function.length` pin
and the leaf-import guard. Stated plainly because a 14-failure RED could otherwise be read
as covering all 20 cases.

## The four disjointness axes, and how each was proven

CONTEXT.md's D-12 names three constraints. RESEARCH C-4 adds the fourth, and it is the one
a planner would have missed.

| Axis | How it is proven | Which mutation catches a regression |
|------|------------------|-------------------------------------|
| lowercase hex only (`HASH_PATTERN`, so `<run_id>-<os>` is NOT representable) | `HASH_PATTERN.test(...)` per OS | any non-hex marker |
| NOT all-decimal (disjoint from run ids and Nx task hashes) | `toMatch(/[a-f]/)` per OS -- STRUCTURAL, since both spaces are all-decimal | mutation 1 (drop the marker's role) |
| OS component from the REAL `CACHE_OS_VALUES` | `toContain(MARKER + CACHE_OS_VALUES.indexOf(os))` per OS, plus `Record<CacheOs, string>` making a fourth member a TYPE error | mutation 1 |
| **disjoint from the shipped `cafe<run_id>` family** | `startsWith('cafe')` is `false` per OS, plus an exact-equality belt | mutation 2 |

**How disjointness from `cafe<run_id>` was established as a real constraint, not a
theoretical one:** `ci.yml:944-949`'s `consumer-smoke` job already seeds `cafe${{
github.run_id }}` with a comment carrying the identical hex-word-marker rationale, and its
assets are LIVE in the shard right now (`cafe30401077417-linux`, `cafe30400231720-linux`,
`cafe30400231720-windows`). So the repo already had this exact convention. The plan's
resolution -- follow the precedent with a DIFFERENT marker word -- is what keeps the two
families distinguishable in a shard listing, and the `startsWith` clause is what makes it
a guard instead of a preference. Colliding here would have been a live-shard name
collision.

**The fifth property, which is a PRECONDITION rather than an axis:** `CACHE_OS_VALUES`
holding under ten members. Pinned separately, because the injectivity case structurally
cannot carry it -- see the deviation below.

## The url trap, and why the test is provably non-vacuous

`action/index.ts` builds `const url = ...${hash}` from the RAW input ABOVE the operation
branches. A `mirror-seed` branch reusing it PUTs at `nx-cache-<run_id>` -- and the PUT still
returns 200, so nothing fails on the producing side and the break surfaces only as a
`publish-verify` MISS on the next push. The branch therefore builds its own `seedUrl`, and
the spec asserts the WHOLE url plus the final PATH SEGMENT.

The plan warned that a naive `toContain(RUN_ID)` would be vacuous here, because the derived
seed CONTAINS the run id. That was verified by experiment rather than accepted:

1. Mutation 3 applied (branch reuses `url`) -> the three `it.each` PUT cases redden.
2. **With mutation 3 STILL LIVE**, the two URL assertions were replaced by
   `expect(String(requestedUrl)).toContain(RUN_ID)` -> **`722 passed (722)`**. The entire
   suite goes green with the trap wide open.
3. Both reverted.

Two things fall out of step 2 that are worth recording:

- The substring form is vacuous *by construction*, exactly as predicted.
- **The BODY assertion does not catch the url trap either.** Reusing `url` leaves
  `dogfoodBody(seedHash, producerOs)` correct, so `expect(init?.body).toEqual(...)` stays
  green. The path assertion is the ONLY clause that closes this trap -- the body clause
  answers a different question (that the leg's identity reaches the payload).

## Mutation checks (predicted first, then observed)

GREEN was committed BEFORE any mutation, per plan 10-02's recorded lesson, so every revert
was a revert to the intended state. Nothing was committed mutated.

| # | Mutation | Predicted | Observed | Verdict |
|---|----------|-----------|----------|---------|
| 1 | drop the OS index (`feed${runId}`) | 3 pinned literals + 3 marker-slot + 1 injectivity = 7; hex-letter, `cafe` and the action spec unaffected | `7 failed \| 715 passed`, exactly that set | as predicted |
| 2 | marker word -> `cafe` | 3 pinned literals + 3 marker-slot + 3 `cafe` = 9; injectivity and hex-letter stay green (`cafe` also has letters) | `9 failed \| 704 passed`, exactly that set | as predicted |
| 3 | branch reuses the shared `url` | the 3 `it.each` PUT cases only; the non-200 case is status-driven and stays green; `mirror-seed.spec.ts` untouched | `3 failed \| 719 passed`, exactly the three PUT cases | as predicted |
| 4 | a tenth `CACHE_OS_VALUES` member (ANALYTIC, the real tuple was NOT edited) | the length pin is what fails at ten | reasoning below -- and it CORRECTED the source comment | as predicted, with a finding |

**Mutation 1 leaves the action spec green, and that is correct rather than a gap.** The
action spec derives its URL expectation from `mirrorSeedHash`, so it is self-consistent
under any change to the helper. Pinning the encoding is `mirror-seed.spec.ts`'s job; the
action spec's job is that the branch uses the helper's output rather than the raw input.
Duplicating the literals into the action spec would add no coverage and one more place to
edit.

**Mutation 4, worked out rather than assumed.** At ten members the index stops being one
character, so the boundary between the index slot and the run id stops being POSITIONAL:
`feed1` followed by `0<run_id>` renders identically to `feed10` followed by `<run_id>`. The
seed therefore loses injectivity over the whole `(runId, os)` domain. Two legs of the SAME
run would still differ, which is why the injectivity case would keep passing right past the
tenth member and why the length bound has to be asserted on its own. Adding OS number ten
has to change the ENCODING -- a separator, or a fixed-width index -- not just the tuple.

## ROBUST-04 / bundle obligation: ZERO, measured with a positive control

A new leaf reachable only from `action/index.ts` is unreachable from `serve()`, so the
correct delta is zero. Probed rather than inherited, with a positive control so a false zero
could not read as confirmation:

```
rg -uu -c -F 'mirrorSeedHash' start-cache-server/index.js  -> exit 1 (absent)
rg -uu -c -F 'mirror-seed'    start-cache-server/index.js  -> exit 1 (absent)
rg -uu -c -F 'dogfoodBody'    start-cache-server/index.js  -> exit 1 (absent)
rg -uu -c -F 'cachePlatform'  start-cache-server/index.js  -> 2, exit 0   (POSITIVE CONTROL)
```

`git diff --stat 7cb071b..HEAD -- start-cache-server/index.js` prints nothing.
`npm run build:action` was correctly NOT run, so the entire ROBUST-04 obligation stays on
plan 10-07's `releaseAssetName` edit.

## Deviations from Plan

### 1. [Rule 2 - Missing critical follow-through] `EDITED_FILES` gained `mirror-seed.ts`

- **Found during:** the read-first pass, from plan 10-03's own comment
- **Issue:** `docs-same-os-claims.spec.ts:200-204` says in as many words that
  `mirror-seed.ts` is absent from the retraction scan's `EDITED_FILES` only because it does
  not exist yet, and that **"the later plans in this phase that CREATE those files extend
  this list in the same commit."** This plan creates it. `docs-same-os-claims.spec.ts` is
  not in the plan's `files_modified`.
- **Fix:** the file was added to `EDITED_FILES` in `f94a8ee` -- the same commit that created
  it, as required, since `read()` is a `readFileSync` that THROWS on a missing path (adding
  it in the RED commit would have blown up the whole guard file rather than guarded).
  The comment was updated to record that the follow-through happened and that
  `release-asset-name.integration.spec.ts` is still legitimately pending.
- **Why it is not scope creep:** the retraction guard now scans the new leaf for the
  producer-attribution claim OBS-03 retracted, which is the point of the widened scope plan
  10-03 built. Leaving it out would have silently narrowed a guard one commit after it was
  widened.
- **Committed in:** `f94a8ee`

### 2. [Rule 1 - Wrong claim in a comment lock] What the length bound actually guards

- **Found during:** mutation check 4
- **Issue:** both comment locks claimed the single-digit slot "stops separating the legs" at
  ten members. That clause is FALSE -- `feed1<run_id>` and `feed10<run_id>` are different
  strings, so two legs of the same run still differ at ten.
- **Fix:** both comments now state the real failure (positional boundary loss, hence
  injectivity loss over the whole `(runId, os)` domain) AND the reason the injectivity case
  cannot carry the claim. Comments only, no behaviour change.
- **Why it counts as a bug rather than a wording nit:** a comment lock's whole function is
  to stop a future reader reconstructing a rejected argument. One that misstates the failure
  mode invites exactly the "then why is this assertion here?" deletion it exists to prevent.
- **Committed in:** `28ae2da`

### 3. [Rule 2 - Stale prose about a changed contract] the `hash` input description

- **Found during:** the `action.yml` edit
- **Issue:** the `hash` input's description enumerated the operations that require it as
  "'seed' and 'verify'". `mirror-seed` requires it too.
- **Fix:** extended to name all three, plus one clause recording that `mirror-seed` does not
  use it AS the key -- it derives one from it. That distinction is the whole plan.
- **Why:** RESEARCH C-5 names stale prose about a changed signature as the exact class
  Phase 9's regression came from (`test/workspace-root-cwd.ts:38`). Leaving a fresh instance
  behind while fixing the sibling would have been perverse.
- **Committed in:** `f94a8ee`

---

**Total deviations:** 3 (1 required follow-through from a prior plan's own instruction,
1 incorrect comment claim found by the plan's own mutation analysis, 1 stale adjacent
description). No prohibition breached, no scope creep, no requirement claimed beyond what
was measured.

## Prohibitions: verified held

| Prohibition | Held? | Evidence |
|-------------|-------|----------|
| MUST NOT re-purpose `operation: seed` | yes | the `seed` branch is byte-unchanged; `mirror-seed` is a new sibling `if` block between `seed` and `verify` |
| MUST NOT reuse the `url` binding or hoist anything above the branches | yes | the branch declares its own `seedUrl`; `producerOs`, `seedHash`, `seedUrl` and `body` are all branch-local. Proven by mutation 3, not asserted |
| MUST NOT add a new action INPUT | yes | `action.yml` `inputs:` still holds exactly `hash` and `operation`; `public-surface.spec.ts` is untouched and green with no edit to `EXPECTED_ACTION_INPUTS` |
| MUST NOT do hash arithmetic in YAML (D-14) | yes | no `.github/workflows/**` or `action.yml` expression change; the derivation is one TS function |
| MUST NOT edit `.github/workflows/ci.yml` | yes | `git diff --name-only 7cb071b..HEAD -- .github/workflows/ci.yml` prints nothing |
| MUST NOT reuse the shipped `cafe` marker | yes | marker is `feed`; the `startsWith('cafe')` clause is asserted per OS and reddens under mutation 2 |
| MUST NOT put `mirrorSeedHash` in `release-asset-name.ts` | yes | separate leaf; bundle delta ZERO, measured above |
| MUST NOT derive any expected OS value from the running machine | yes | every OS axis is `it.each(CACHE_OS_VALUES)` (6 occurrences in the new spec) with `cachePlatform` partial-mocked in the action spec. No `'linux'` literal was authored in either new/edited spec block, and no `process.platform` |
| ASCII only | yes | no non-ASCII in any file or commit message this plan authored |
| Stage by name, never `git add .`/`-A`/`-u` | yes | every commit staged explicit paths; `.planning/config.json` was modified before this plan started and was never staged |

## Acceptance criteria: measured

| Criterion | Result |
|-----------|--------|
| `nx run @op-nx/github-cache:test --skip-nx-cache` | `Test Files 39 passed (39)`, `Tests 722 passed (722)` (694 before) |
| `npm run typecheck -- --skip-nx-cache` | pass |
| `npm run lint -- --skip-nx-cache` | pass |
| `npx nx format:check` | pass |
| `npm run fallow` (CI gates on `fallow:ci`) | `No issues found` -- the new leaf is credited via the `action/index.ts` entry, no config change needed |
| `rg -c '^export ' mirror-seed.ts` | 1 |
| `rg -c '^import' mirror-seed.ts` / `rg -c "from '\.\./" mirror-seed.ts` | 1 / no match (exit 1) |
| `rg -c 'it\.each\(CACHE_OS_VALUES\)' mirror-seed.spec.ts` | 6 |
| `rg -c "\['linux', *'windows'\]" mirror-seed.spec.ts` | no match (exit 1) |
| `rg -c 'CACHE_OS_VALUES\.length' mirror-seed.spec.ts` | 2 |
| `mirror-seed` in `action/index.ts` | 5 lines, 5 occurrences (counted with `rg -o \| wc -l`, not `rg -c`) |
| `mirror-seed` in `action.yml` | 3 |
| `git diff --name-only -- .github/workflows/ci.yml` | empty |
| `git diff --stat -- start-cache-server/index.js` | empty |
| `git diff --diff-filter=D --name-only 7cb071b..HEAD` | empty -- no file deletions |

`--skip-nx-cache` is not optional on any of these: Phase 9 measured a stale `Cache: 2/2 hit`
PASS after a spec-only edit.

## Threat model: dispositions as executed

| Threat | Disposition | How it was closed |
|--------|-------------|-------------------|
| T-10-06 (spoofing via the new `operation` value) | mitigate | The branch selects a verb and a key derivation only. The TRUST-05 clause above the branches is unchanged and the new branch's comment restates its force. No new action input, so D2-02 holds and PARITY-07's guard is untouched |
| T-10-17 (seed-key collision) | mitigate | Structural over all four spaces, asserted per OS; injectivity plus its separately-pinned precondition. Mutations 1 and 2 demonstrate the guards bite |
| T-10-18 (PUT at the raw run id) | mitigate | Branch-local url, proven by mutation 3 AND by the weakened-assertion experiment showing a substring check would have missed it |
| T-10-19 / T-10-05 (payload and mirrored-seed exposure) | accept | Unchanged: `dogfoodBody` is a deterministic derived payload with no secret material, PUT to a loopback sidecar behind the existing per-process bearer token, masked by `setSecret` before any request can print it. No new credential path |
| T-10-SC (package installs) | accept | ZERO new packages. No `package.json` or lockfile edit, no installer run |

## Issues Encountered

The RED scaffold question was the only real decision. A brand-new module's first test run is
naturally a module-not-found import failure, which the mode flags forbid as the only RED. A
`throw new Error('not implemented')` body would technically avoid that while proving just as
little. Landing a scaffold that encodes today's contract -- OS index present, hex marker
absent -- is what made the RED both assertion-level and diagnostic.

## Human verification needed

**Row D7 only, and it is NOT observable yet.** `ci.yml` is deliberately unchanged, so its
`publish` job still runs `operation: seed` and nothing exercises `mirror-seed` on real CI.
Plan 10-05 flips the workflow and `read-back.ts` together as one atomic change; only after
that lands and pushes can the two legs be seen writing different seed keys, with
`nx-cache-feed2<run_id>` and `nx-cache-feed0<run_id>` both present in the shard.

## Self-Check: PASSED

Both created files (`packages/github-cache/src/lib/mirror-seed.ts`,
`packages/github-cache/src/lib/mirror-seed.spec.ts`) and all four modified files exist on
disk. All three task commits (`9d4dde7`, `f94a8ee`, `28ae2da`) are present in
`git log --all`. The working tree carries no uncommitted source change. This file is
ASCII-clean.
