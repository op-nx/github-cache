---
phase: 09-os-invariant-actions-cache-version
plan: 08
subsystem: roundtrip-guard
status: complete
gap_closure: true
tags:
  - gap-closure
  - cross-os-provenance
  - non-vacuity-preserved
  - context-override
  - first-spec-for-a-bin
requires:
  - 09-01 # ci.yml as a `test` input -- without it a stale cached PASS could mask the new spec
  - 09-03 # CACHE_ARCHIVE_DIR + enableCrossOsArchive (VER-03), one of the two changes that falsified the same-OS premise
  - 09-05 # dogfoodBody(hash, producerOs) -- CONSUMED unchanged; its dogfood-verify literal is deliberately not touched
provides:
  - read-back.spec.ts # the FIRST spec this bin has ever had: 3 producer-acceptance cases, 4 rejection cases, 1 input-guard case
  - run # exported from roundtrip/read-back.ts (internal module export, matching cleanup/index.ts and action/index.ts)
  - the producer scan # CACHE_OS_VALUES.find over dogfoodBody(hash, os), replacing the producer-equals-reader identity
  - the provenance-naming success line # names WHICH producer OS matched, in 09-05's `'<os>'-produced payload` idiom
  - the two-guards-differ comment lock # records the asymmetry with dogfood-verify in BOTH directions, plus the CONTEXT override and the stale ci.yml sibling by job name
affects:
  - .github/workflows/ci.yml # publish-verify's read-back step behaviour changes; the FILE is NOT edited (Phase 10 / TRUST-11 owns its comment)
tech-stack:
  added: [] # no new npm package, no new import edge -- CACHE_OS_VALUES comes from the same module that supplied cachePlatform
  patterns:
    - bin-exports-run-driven-by-colocated-spec # cleanup/index.ts:68 + action/index.ts, behind the same isEntrypoint guard
    - A1b # hand-authored pinned literals for the hash and the corruption fixtures
    - it.each-over-the-runtime-tuple # machine-independent OS axis, so no ambient platform read (LINT-02)
    - same-length-neighbour-fixture # the only different-hash fixture that reddens a length-only comparison
key-files:
  created:
    - packages/github-cache/src/roundtrip/read-back.spec.ts
  modified:
    - packages/github-cache/src/roundtrip/read-back.ts
decisions:
  - The producer set is REUSED from CACHE_OS_VALUES, never re-authored -- no OS literal appears anywhere in read-back.ts
  - No extracted pure module: hash-parity/compare.ts's reason (serving an untyped root .mjs) does not transfer, and both sibling bins already export run() behind isEntrypoint
  - The rejection substrings are pinned to 'cache HIT for' / 'MISS' because both are present in the pre-fix AND post-fix messages -- that continuity is the evidence Group B was preserved rather than traded away
  - The module doc block's same-OS claim was ALSO corrected (deviation, below) -- a header comment that contradicts the code it heads is this plan's own defect class
  - ci.yml is NOT edited; its publish-verify comment stays Phase 10 / TRUST-11 and is named BY JOB in the code lock
metrics:
  duration: ~35 min
  completed: 2026-07-29
  tasks: 3
  commits: 2
  tests_before: 663 across 37 files
  tests_after: 671 across 38 files
requirements: [] # DELIBERATELY EMPTY -- see "The requirement-ID gap" below
---

# Phase 09 Plan 08: Cross-OS Provenance for the Round-Trip Read-Back Summary

`roundtrip/read-back.ts` stops asserting that a mirrored asset was produced on its OWN OS and
instead resolves WHICH known producer wrote the bytes, naming it in the log -- closing a
phase-caused regression that was measured live on `publish-verify (windows-11-arm)`.

## What was built

The bin used to ask "do these bytes equal MY OS's payload?". It now asks "do these bytes equal a
KNOWN producer's payload for THIS hash, and which one?":

```ts
const producerOs = CACHE_OS_VALUES.find((os) =>
  result.bytes.equals(dogfoodBody(hash, os)),
);

if (producerOs === undefined) { throw new Error(/* widened message */); }
```

Three parts, plus the bin's first spec:

1. **`run` is exported** (`packages/github-cache/src/roundtrip/read-back.ts`) behind the existing
   `isEntrypoint(import.meta.url)` guard, matching `cleanup/index.ts` and `action/index.ts`. An
   internal module export, NOT a barrel export -- the DOCS-05 consumer surface is unchanged.
2. **The producer scan** replaces `bytes.equals(dogfoodBody(hash, <reader's own platform>))`. The
   import swapped `cachePlatform` for `CACHE_OS_VALUES` from the SAME module: no new dependency
   edge, and the last ambient platform read in the comparison went away rather than moving.
3. **The success line names the matched producer**, in the same
   `'<producerOs>'-produced payload` idiom as 09-05's `dogfood-verify` line, so a human reading
   both jobs' logs sees one vocabulary. The failure message reports that NO known producer matched,
   enumerates the tried set from `CACHE_OS_VALUES.join(', ')`, and keeps all three surviving
   hypotheses (partial upload, cross-run name collision, different hash).
4. **`packages/github-cache/src/roundtrip/read-back.spec.ts` (NEW)** -- the first spec this bin has
   ever had. Eight tests: three producer-acceptance cases, four rejection cases, one input guard.

### The relaxation, stated exactly

The delta versus the guard it replaces is `{dogfoodBody(hash, os) : os != the reader's own OS}` --
**two specific byte strings, for this hash only.** Nothing else. Acceptance still requires exact
byte equality against one of exactly three derivable payloads, each of which folds the HASH into
its bytes (`dogfood-body.ts:41`). There is no presence check, no length check, and no HIT-only
check anywhere in the replacement.

## The CONTEXT override -- recorded, not left to be discovered

**`09-CONTEXT.md:794` deferred this exact file to Phase 10**, verbatim:

> **`publish-mirror.ts:159`'s "byte-identical under CORR-01" comment** and `ci.yml:1053-1061` /
> `read-back.ts`'s same-OS claims -- Phase 10 (TRUST-11 / OBS-05), explicitly NOT this phase's
> DOCS-08 work.

This plan closed the `read-back.ts` half of that locked deferral **in Phase 9**. The override rests
on **the maintainer's explicit routing decision after the failure was MEASURED** --
`09-EVIDENCE.md`'s ADDENDUM records "Routed to Phase 9 gap closure by maintainer decision", and
`09-VERIFICATION.md` accepts that as supplanting the deferral for this specific measured instance.
It does NOT rest on a re-reading of the context, and it does NOT reopen the deferral's other halves.

**What remains Phase 10 / TRUST-11:**

| Remaining half | Why it is still stale after this plan |
|---|---|
| `ci.yml`'s **`publish-verify` job comment** | Still reads "Each OS leg reads back ONLY its own-OS asset ... so this proves the same-OS publisher->reader contract". FLATLY FALSE about what the code now asserts -- the exact stale-prose class this plan exists to fix. This plan does not edit `ci.yml` (scope fence). |
| `publish-mirror.ts:159`'s "byte-identical under CORR-01" comment | Untouched, as deferred. |

The code comment lock in `read-back.ts` **names the `publish-verify` job by JOB NAME** (not line
number -- this phase measured `ci.yml` drifting ~220 lines inside one milestone) and says plainly
that **TRUST-11 must NOT be closed on the strength of `read-back.ts` having already changed.**
Without that pointer, a Phase 10 executor diffing CONTEXT's deferral list against the tree would
see `read-back.ts` already changed and could close TRUST-11 over a still-false `ci.yml` comment.

Leaving `ci.yml` alone reddens nothing: `docs-same-os-claims.spec.ts`'s two `ci.yml` rows key on
the `publish` job and the `integration` job. **Neither keys on `publish-verify`.**

## The requirement-ID gap

`requirements: []` is deliberate. `09-VERIFICATION.md` is `gaps_found` with all ELEVEN requirements
verified -- the gap sits OUTSIDE the list, which is the verifier's own point: DOCS-08 enumerated
four **documentation** sites asserting same-OS restore; `read-back.ts:63-67` was a **fifth site, in
EXECUTABLE LOGIC**, and no requirement among the eleven named it. Stretching DOCS-08 to cover it
would falsify DOCS-08's own enumeration (its six rows are three `.md` files plus `ci.yml`; no `.ts`
path). This is a **phase-caused regression on an existing CI guard**, not an unmet requirement.

**The generalisable lesson, which belongs in the record rather than in a requirement:** a
same-OS-invariant sweep must enumerate **CODE PATHS, not only prose**. DOCS-08's four sites were
found by phrase-searching documentation; this fifth site was a `//` comment sitting directly above
the executable comparison it justified. Phase 10's TRUST-11 is the natural home for that widened
sweep. It is recorded in the comment lock in `read-back.ts`.

## The RED, honestly

**ASSERTION-LEVEL, not an import or link failure.** Exactly three failures, all from the Group A
`it.each(CACHE_OS_VALUES)`, with the suite running to completion.

Counts at the RED commit (`acd37d0`): **3 failed | 668 passed (671) across 38 files**
(1 failed file | 37 passed).

Verbatim failures, on this Windows (`win32`) workstation:

| Case | Verbatim failure |
|---|---|
| `A[windows]` (this machine's OS) | `AssertionError: expected "vi.fn()" to be called with arguments: [ StringContaining{…} ]` -- Received: `"github-cache round-trip read-back: cache HIT for 30400231720 on win32; the real publisher/reader round-trip is closed."` vs expected `StringContaining "'windows'-produced"`. It PASSED the no-throw assertion and failed the LOG assertion, because the pre-fix success line names no producer at all. |
| `A[macos]` | `AssertionError: promise rejected "Error: github-cache round-trip read-back:…" instead of resolving` / `Caused by: Error: github-cache round-trip read-back: cache HIT for 30400231720 on win32 but the returned bytes are not what the publisher wrote -- suspect the asset-name discriminator colliding across runs, or a partial upload.` |
| `A[linux]` | Identical to `A[macos]`. |

The three-failure count is **machine-INDEPENDENT by construction**: whichever `CACHE_OS_VALUES`
member matches the running machine fails the log assertion, and the other two fail the no-throw
assertion. Three on any machine. The spec needs no ambient platform read, which LINT-02 bans in
unit specs.

### Groups B and C were GREEN at RED -- evidence, not a gap

| Clause | State at RED | Why that is correct |
|---|---|---|
| B1 garbage bytes | GREEN | The guard ALREADY rejected these. |
| B2 truncated payload (partial upload) | GREEN | Ditto. `Buffer.equals` compares length first. |
| B3 different, SAME-LENGTH hash | GREEN | Ditto. The hash is folded into the payload bytes. |
| B4 cache MISS | GREEN | A different branch entirely; untouched by this plan. |
| C1 absent `GITHUB_RUN_ID` | GREEN | A pre-existing input guard with ZERO coverage until now. |

**These five clauses are the guards the fix had to PRESERVE, and their staying green across
RED -> GREEN is the proof they were preserved rather than traded away.** Their rejection substrings
are pinned to `'cache HIT for'` (B1-B3) and `'MISS'` (B4) precisely because both are present in the
pre-fix AND post-fix messages. Reaching instead for a post-fix-only phrase would have produced
six or seven failures at RED, contradicting the exactly-three claim -- and the cheapest-looking
reconciliation would have been to relax that criterion, losing exactly this evidence.

### The RED tree was otherwise CLEAN

All EIGHT non-`test` battery commands exited 0 at commit `acd37d0`:
`format:check`, `build`, `typecheck`, `typecheck:action`, `lint`, `fallow:ci`,
`check:action` (**EMPTY diff, OBSERVED**), `pack:check`.

That is what made a separate `test(09-08)` commit defensible here where 09-05's was not (its RED
tree failed `typecheck` with 9 x TS2554) and where 09-03/09-06 refused for rotation and
phrase-ordering reasons. Nothing rotates here, and the tree compiles: a reviewer can check out
`acd37d0` and build it.

## Mutation Testing (Task 3)

Each mutation was **applied, OBSERVED first-hand, and reverted**, with green reconfirmed after.

| # | Mutation | Predicted | **OBSERVED** | Match? |
|---|---|---|---|---|
| M1 | Restore the same-OS premise: `bytes.equals(dogfoodBody(hash, cachePlatform()))`, WITH `cachePlatform()` substituted into the success line | 2 red, machine-dependent, the own-OS case surviving | **2 red: `A[macos]` + `A[linux]`** on a **`win32` (Windows) workstation**; `A[windows]` survived | EXACT |
| M2 | Length-only comparison: `bytes.length === dogfoodBody(hash, os).length` | `B3` + `A[linux]` | **2 red: `B3` + `A[linux]`** | EXACT |
| M3 | Drop the throw -- `core.info` and continue when `producerOs` is `undefined` | `B1` + `B2` + `B3` | **3 red: `B1` + `B2` + `B3`**; B4 and C1 green (different branches) | EXACT |
| M4 | Stop surfacing the producer -- revert the success line to its pre-Task-2 wording | all three Group A cases red on the LOG assertion, no-throw still passing | **3 red: all three Group A cases**, each on the `core.info` assertion | EXACT |

**No mismatches.** All four predictions -- including the plan-check's three corrections (A3) --
held exactly. Verbatim observations worth keeping:

- **M1** required the success-line substitution to compile at all: deleting `producerOs` orphans
  the Task-2 log line. Substituting `cachePlatform()` there is also what lets the own-OS case
  survive, because the log then renders the same producer name for that one case. Its failure was
  `Caused by: Error: github-cache round-trip read-back: cache HIT for 30400231720 on win32 but the
  returned bytes match NO known producer OS -- tried windows, macos, linux. ...`
  **M1's redness set is machine-DEPENDENT, and that machine dependence IS the defect being fixed.**
  On ubuntu CI the surviving case would be `A[linux]` instead.
- **M2** reddened `A[linux]` as well as `B3`, and that is NOT a defect: `dogfoodBody(hash,'macos')`
  and `dogfoodBody(hash,'linux')` are BOTH 41 bytes for an 11-digit run id, so under a length-only
  comparison `.find` returns `macos` first and the linux case fails its `'linux'-produced` log
  assertion (`AssertionError: expected "vi.fn()" to be called with arguments:
  [ StringContaining "'linux'-produced" ]`). B3 reddened with `AssertionError: promise resolved
  "undefined" instead of rejecting` -- **the control proving B3's same-length fixture earns its
  place.** A naive different-length fixture would have left M2 entirely green. B1 (28 bytes) and
  B2 (12 bytes) stayed green as predicted.
- **M3 is the vacuity mutation** -- what "weaken the guard to a presence check" actually looks like
  in code. All three reddened with `AssertionError: promise resolved "undefined" instead of
  rejecting`. Loudly caught.

## Deviations from Plan

**1. [Rule 2 - missing critical correctness] The module doc block's same-OS claim was also corrected**

- **Found during:** Task 2 STEP 4.
- **Issue:** The plan's STEP 4 scopes the comment lock to replacing the false-premise comment at
  `read-back.ts:63-67`. But the file's **module doc block** carried a SECOND same-OS claim:
  *"Each OS leg resolves ONLY its own-OS asset ..., so this proves the same-OS publish->reader
  contract live"*, plus *"asserts a HIT WHOSE BYTES equal dogfoodBody(hash)"*. Left as-is, the
  file's own header would contradict the code it heads -- **the exact stale-prose class this plan
  exists to fix**, and the same failure mode (a comment above executable logic asserting an
  invariant the logic no longer holds) that caused the regression in the first place.
- **Fix:** Corrected both sentences. The doc block now draws the distinction precisely -- the asset
  **NAME** is same-OS, the **PAYLOAD behind it is not** -- and points at the comparison-site lock
  for the full reasoning. Purely a comment change; no behaviour, no signature, no import.
- **Files modified:** `packages/github-cache/src/roundtrip/read-back.ts` (doc block only).
- **Commit:** `fc37f0f`.

**2. [Rule 3 - acceptance criterion unreachable as literally worded] Two grep criteria reworded rather than relaxed**

- **Found during:** Task 1 STEP 4 and Task 2 STEP 5.
- **Issue:** Two acceptance criteria are phrased as `git grep ... returns NO lines`
  (`process.platform|process.arch` in the spec; `cachePlatform` in the bin). Both initially returned
  ONE line each -- in **explanatory PROSE inside a comment**, not as a code read: the spec's header
  explained *why* it avoids the banned member, and the bin's lock recorded *which* expression the
  comparison used to use. Neither is a `MemberExpression`, so `lint` (the enforcing check, which the
  criteria themselves name as such) passed both times.
- **Fix:** Reworded both comments to convey the same fact without the bare token -- "an ambient
  platform read", and "derive its ONE expected payload from the READER's own platform (via the
  ambient platform-mapping helper in `release-asset-name.ts`)". Both greps now return zero lines, so
  the readable check and the enforcing check agree and no future reader has to re-litigate the
  discrepancy. **The criteria were satisfied literally, not relaxed.**
- **Files modified:** `packages/github-cache/src/roundtrip/read-back.spec.ts` (pre-RED-commit),
  `packages/github-cache/src/roundtrip/read-back.ts`.
- **Commits:** `acd37d0`, `fc37f0f`.

No other deviations. No authentication gates. No architectural (Rule 4) decisions arose.

## Verification

| Check | Result |
|---|---|
| `npm run format:check` | PASS |
| `npm run build` | PASS |
| `npm run typecheck` | PASS |
| `npm run typecheck:action` | PASS |
| `npm run test` | PASS -- **671 passed (671) across 38 files** (663 across 37 before) |
| `npm run lint` | PASS |
| `npm run fallow:ci` | PASS -- 0 issues, 57 entry points |
| `npm run check:action` | PASS, **EMPTY diff -- OBSERVED at BOTH commits, not inferred** |
| `npm run pack:check` | PASS -- 55 files, no internals leaked |

**Bundle obligation discharged by observation, in both directions.** `read-back.ts` is NOT
`serve()`-reachable (the bundle has one entry, `start-cache-server/entry.ts`), but D-26 and Phase
7's Q10 (an 88-line bundle drift with NO source edit) say the diff is CHECKED, never assumed. Run
at both commits: empty. `start-cache-server/index.js` is **not among the files changed by either
commit**.

**Untouched, verified via `git diff --name-only 376dbff..HEAD` returning exactly two paths:**
`src/lib/dogfood-body.ts`, `src/action/index.ts`, `src/dogfood-cross-os.spec.ts`,
`.github/workflows/ci.yml`, `src/public-surface.spec.ts`, `src/index.ts`,
`src/test/consumer-contract.ts`. 09-05's and 09-06's guards are byte-unchanged; no package export,
env knob or action input changed (PARITY-07, D2-02).

`git diff --diff-filter=D` across both commits: **no deletions.** No `git stash`, `git clean` or
`git reset` at any point.

**Commits (exactly two, in order):**

| Commit | Subject | Paths |
|---|---|---|
| `acd37d0` | `test(09-08): specify cross-OS provenance for the round-trip read-back` | `read-back.ts`, `read-back.spec.ts` |
| `fc37f0f` | `fix(09-08): accept a cross-OS-produced payload in the round-trip read-back` | `read-back.ts` |

## Open Items

### human_needed: the LIVE `publish-verify` green (merge-gated, NOT closable here, NOT claimed)

`publish-verify` is push-gated to `main` -- `ci.yml:3-7` filters `push` to `branches: [main]` and
the job carries `if: github.event_name == 'push'` (`:1113`). **The live green CANNOT be observed
pre-merge, and nothing in this plan claims it.** No acceptance check was authored that a pre-merge
run could satisfy for it (C-06). The fixture/spec proof IS achievable pre-merge and is this plan's
closing evidence.

- **Where it will be read:** the first push to `main` after this branch merges, job
  `publish-verify`, **BOTH** matrix legs (`ubuntu-24.04-arm`, `windows-11-arm`, `fail-fast: false`).
- **What closes it:** both legs green. The confirming log line is
  `github-cache round-trip read-back: cache HIT for <run_id> on <platform> with bytes matching a
  '<producerOs>'-produced payload; the real publisher/reader round-trip is closed.`
  **On the Windows leg, a `'linux'` producer in that line is the POSITIVE observation** -- it is the
  same cross-OS mirror that produced the measured failure, now correctly accepted and recorded.
- **Re-samplable:** yes, every push to `main`. Unlike OBS-04's one-shot rotation signal, an
  inconclusive first push is recoverable.
- **If a leg goes RED that is a REAL RESULT,** and the message names which class failed: a MISS
  (asset absent / shard / discriminator) versus no-known-producer (partial upload, cross-run
  collision, different hash).
- **What it does NOT close:** OBS-05. A green `publish-verify` after this change does NOT prove the
  Windows publish path is alive.

`action-bundle-drift` has NO `if:` gate (`ci.yml:99-114`) and DOES run on `pull_request`, so the
bundle half is observable pre-merge -- and was, locally, via `check:action` at both commits.

### Scheduled to Phase 10 (accepted, named, owned -- not unnoticed)

| Item | Owner |
|---|---|
| A dead Windows publish path passing on the ubuntu leg's bytes | ROADMAP Phase 10 item 3 / **OBS-05** (leg-distinguishable seed hashes per publish leg) |
| An OS-discriminator collapse WITHIN one run (a CORR-01 regression in `releaseAssetName`) | Same. Under today's SHARED run-scoped seed key this signal is **INSEPARABLE** from the false alarm being fixed -- both legs mirror the same payload, so the old guard's Windows failure IS both at once. It stays unit-pinned by `release-asset-name.spec.ts` and CORR-01's non-vacuity proof in `releases-backend.spec.ts`. |
| `ci.yml`'s `publish-verify` job comment (still asserts the same-OS contract) | **TRUST-11**, named BY JOB in the code lock |
| `publish-mirror.ts:159`'s "byte-identical under CORR-01" comment | TRUST-11, untouched as deferred |
| Widening the same-OS-invariant sweep to CODE paths, not only prose | TRUST-11 |

Once OBS-05 lands, the producer becomes knowable per leg again and this scan can tighten back to an
exact expectation. **The `producerOs` now surfaced in the log line is the input a Phase 10 executor
reads to confirm that tightening is correct.**

**Cross-RUN collision is still caught** (the hash differs), so the failure message's surviving
hypothesis is accurate as written -- it must not be widened to imply otherwise.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change at a trust boundary.
The spec mocks `../backend/releases-backend.js`, so no client is constructed, no token is resolved
and no request is made (T-09-64); the bin's messages carry only the hash, the platform and the OS
enum -- never bytes, URLs or headers.

## Known Stubs

None.

## Self-Check: PASSED

- `packages/github-cache/src/roundtrip/read-back.spec.ts` -- FOUND (created, committed `acd37d0`)
- `packages/github-cache/src/roundtrip/read-back.ts` -- FOUND (modified in both commits)
- Commit `acd37d0` -- FOUND in `git log`
- Commit `fc37f0f` -- FOUND in `git log`
- `git diff --name-only 376dbff..HEAD` returns exactly the two paths above -- CONFIRMED
- `start-cache-server/index.js` absent from both commits -- CONFIRMED
