---
quick_id: 260803-3g1
verified: 2026-08-03T01:29:41Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
commits_verified:
  - 3faab10afb7b50f7a6dade432a454f47c2308eaa
  - 40e4d211ea27f424908ca78e77330385ee113278
  - ccc18c92c016161113895fd69d3ef2cdaa96dc2d
diff_base: ed3b72d434963b4b15d2d2d897b4199354d7f0f8
scope_note: >-
  This quick task's own must_haves (B1+B2, D1, D2) are fully verified against the
  codebase. The task's GOAL TEXT ("until milestone v0.0.2 is fully verified") is
  DELIBERATELY not closed by this plan alone: B3 (13-VERIFICATION.md status:
  human_needed) remains unresolved, and the main-branch verification window plus
  /gsd:audit-milestone have not run. Both are explicitly out of scope per the
  PLAN's own execution_rules ("Do NOT push to main and do NOT run
  /gsd:audit-milestone -- the orchestrator owns the verification window after
  this plan lands") and per CONTEXT's B3 disposition. This is reported as a scope
  boundary, not a gap or a failure -- the milestone-level clause cannot be
  evaluated as passed OR failed by this verification.
---

# Quick Task 260803-3g1 Verification Report

**Task goal (as stated):** Resolve remaining blockers and defects until milestone v0.0.2 is
fully verified
**Task's actual planned scope (per PLAN.md and CONTEXT.md):** Close B1+B2 (createRelease 422
classifier), D1 (o3-witness Case-B safety), and D2 (versioning.md export drift + guard gap).
B3 and the milestone-level verification window are explicitly NOT PLANNED, orchestrator-owned.
**Verified:** 2026-08-03T01:29:41Z
**Status:** passed (for the plan's own must_haves -- see Scope Note below for the goal-text
clause this plan cannot close alone)

## Method

This report does not take SUMMARY.md's claims on trust. Every commit was re-read via
`git show`, every test file was re-run independently from the current working tree (not from
the SUMMARY's pasted output), and three of the SUMMARY's RED claims were reproduced from
scratch by mutating the shipped source, running the specific spec, confirming the intended
clause reddened, then restoring byte-exact and proving it with `git diff --quiet`. The Q2
defect-class sweep was re-run independently rather than re-read from the SUMMARY table.

## Goal Achievement -- Observable Truths (from PLAN.md must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `createRelease` 422 whose body does NOT carry explicit `already_exists` fails loud, printing `errors[].code` AND `errors[].message` (falling back to top-level `message`) -- never silent re-GET | VERIFIED | `publish-mirror.ts:212` gates the race path on `statusOf(error) === 422 && reason.code === 'already_exists'`; `faultReason()` (lines 156-171) reads code+message with the documented fallback. Reproduced: reverting the guard to the old `statusOf(error) === 422` (mutation, restored byte-exact) reddens 2 of the 4 new discriminating clauses (`Tests 2 failed | 30 passed (32)`). |
| 2 | A `createRelease` 422 with an UNREADABLE body fails CLOSED (throws). Absent body never read as benign at either 422 site | VERIFIED | Same guard covers both; test `REJECTS a createRelease 422 whose body is UNREADABLE...` passes (`getReleaseByTag` called once, `uploadReleaseAsset` never called). Upload site (line 457) uses the same `faultReason` and unreadable code is `undefined`, which fails the `=== 'already_exists'` check and falls to the real-fault branch. |
| 3 | A genuine `already_exists` 422 still takes the race path, and a fault on that re-read throws an error NAMING the shard tag instead of dying on a bare Not Found | VERIFIED | `publish-mirror.ts:213-230` wraps the re-GET in try/catch, rethrows `Error("...re-read of shard release ${tag}...")` with `cause`. Test `names the tag when the re-read after a genuine already_exists itself 404s` passes. |
| 4 | The one fault reader serves BOTH 422 sites; the upload warning also carries the message, so a `code: custom` policy rejection is diagnosable from the job log alone | VERIFIED | `faultReason` is the single function called at `publish-mirror.ts:212` (create) and `:457` (upload); upload `core.warning` string (line ~474) includes `reason.message`. Test asserts `warned` contains both `code immutable` and `Release asset is immutable`. |
| 5 | `o3-witness` accepts a cache entry on the base/default-branch ref (Case B) while still REQUIRING a ref constraint, still failing on an absent entry, and still printing which ref matched | VERIFIED | `ci.yml:1240-1241` jq select is `.key == $key and (.ref == $ref or ($baseref != "" and .ref == $baseref))` -- an allowlist, never dropped. Empty-result branch still `exit 1` (line 1246). `matched_ref` printed on both the diagnostic line (1316) and the OK line (1326). Independently re-derived against 7 jq fixtures (own-ref, base-ref-only, unrelated ref, empty-ref guard, empty array, key-prefix-only) -- all three negative cases yield empty, matching the SUMMARY's claimed table. |
| 6 | The o3-witness empty-result branch is mechanically pinned to `exit 1`, so the skip-on-empty vacuity this fix could introduce reddens the suite | VERIFIED | M4 clause (`dogfood-cross-os.spec.ts` "still FAILS on an empty cache result... (M4)") reproduced from scratch: mutated `ci.yml`'s `exit 1` (line 1246) to `exit 0`, ran `dogfood-cross-os.spec.ts`, got `1 failed \| 70 passed (71)` with the failure on exactly the M4 clause's first assertion. Restored byte-exact, `git diff --quiet` confirmed, re-run green at 71/71. The corrected regex (`/if \[ -z "\$\{created\}" \]; then\n[^\n]*\n\s*exit 1\n/` plus `.not.toMatch(/exit 0\b/)`) is bounded to the branch's own message line and is NOT vacuous -- confirmed `rg -n "exit 0" .github/workflows/ci.yml` returns zero matches (exit 1, genuine absence, positive-controlled against `exit 1` which returns 3 hits). |
| 7 | `docs/versioning.md` names all six package exports, and dropping any one of them from the doc fails `nx test github-cache` | VERIFIED | `docs/versioning.md:13-16` now lists all six. `docs-adoption.spec.ts` `it.each([...EXPECTED_VALUE_EXPORTS, ...EXPECTED_TYPE_EXPORTS])` asserts each name is contained in the doc text. Reproduced from scratch: removed `ReadableBackend`/`WritableBackend` from versioning.md, ran the spec, got `2 failed | 48 passed (50)` naming exactly those two. Restored byte-exact, re-run green at 50/50. |

**Score:** 7/7 truths verified. 0 present-but-behavior-unverified.

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/github-cache/src/publish/publish-mirror.ts` | fail-closed classifier + shared fault reader | VERIFIED | Substantive, wired at both 422 call sites; `git show 3faab10` confirms the diff matches the SUMMARY's description exactly. |
| `packages/github-cache/src/publish/publish-mirror.spec.ts` | RED-first coverage of the new clauses | VERIFIED | 32/32 passing; rewritten positive control + 4 new/extended clauses present. |
| `.github/workflows/ci.yml` | o3-witness Case-B allowlist, no server-side ref narrow | VERIFIED | Confirmed via `git show 40e4d21` diff and direct file read (lines 1094-1328); valid YAML (`js-yaml` parse OK, 21 jobs). |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` | 8-clause o3-witness pin including M4 | VERIFIED | 71/71 passing; M4 clause reproduced RED under mutation as documented above. |
| `packages/github-cache/src/test/consumer-contract.ts` | single source of `EXPECTED_VALUE_EXPORTS`/`EXPECTED_TYPE_EXPORTS` | VERIFIED | Arrays declared once, imported by both `public-surface.spec.ts` and `docs-adoption.spec.ts`. |
| `packages/github-cache/src/docs-adoption.spec.ts` | prose guard for all six exports | VERIFIED | `it.each` over the concatenation; reproduced RED under mutation. |
| `docs/versioning.md` | names all six exports | VERIFIED | Lines 13-16 list `createCacheServer`, `CacheBackend`, `GetHit`, `GetResult`, `PutResult`, `ReadableBackend`, `WritableBackend`. |

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ensureShardRelease`'s 422 branch | `faultReason(error).code === 'already_exists'` | same classifier as upload site | VERIFIED | Both call sites (lines 212, 457) call the identical `faultReason` function; no second body-parser exists (`uploadFaultCode` confirmed absent via `git grep`, exit 1, positive-controlled by `faultReason` grep hit count 5). |
| o3-witness jq expression in `ci.yml` | pinning clause in `dogfood-cross-os.spec.ts` | regex-pinned lockstep | VERIFIED | Both files changed in the same commit (`40e4d21`); the spec's `toMatch` regexes match the exact jq/shell shape shipped. |
| removed server-side `&ref=` query parameter | client-side ref ALLOWLIST | jq `select` widening | VERIFIED | `ci.yml:1239` URL carries only `key=` and `per_page=100`; the ref constraint moved entirely into the jq `select` at line 1241. A dedicated spec clause (`does NOT narrow the caches REQUEST by ref server-side...`) pins the URL's absence of `ref=`. |
| `EXPECTED_VALUE_EXPORTS` / `EXPECTED_TYPE_EXPORTS` in `consumer-contract.ts` | `public-surface.spec.ts` (code) AND `docs-adoption.spec.ts` (prose) | shared import | VERIFIED | Both spec files import from `test/consumer-contract.js`; `public-surface.spec.ts` additionally keeps inline sorted-literal self-checks (2 new `it` clauses) as the human-reviewable pin. |

## Behavioral Spot-Checks (reproduced from scratch, not read from SUMMARY)

| # | Mutation | Spec run | Expected red | Actual result | Restored |
|---|----------|----------|---------------|----------------|----------|
| 1 | `publish-mirror.ts:212` guard reverted from `statusOf(error) === 422 && reason.code === 'already_exists'` to `statusOf(error) === 422` | `publish-mirror.spec.ts` | the unreadable-body and policy-422 clauses fail | `Tests 2 failed \| 30 passed (32)` -- exactly the two clauses that depend on the code check | `git diff --quiet` confirmed |
| 2 | `ci.yml`'s empty-result `exit 1` (o3-witness) changed to `exit 0` | `dogfood-cross-os.spec.ts` | the M4 clause fails | `Tests 1 failed \| 70 passed (71)` -- exactly the M4 clause's bounded-gap assertion | `git diff --quiet` confirmed |
| 3 | `docs/versioning.md` group-1 sentence reverted to omit `ReadableBackend`/`WritableBackend` | `docs-adoption.spec.ts` | exactly those two export clauses fail | `Tests 2 failed \| 48 passed (50)` -- named `ReadableBackend`, `WritableBackend` | `git diff --quiet` confirmed |

Each mutation was a single-line (or single-phrase) change, verified via `git diff` before running
the spec, and restoration was proven with `git diff --quiet` plus a subsequent green re-run of the
same spec file.

## Independent Re-Derivations

- **Q2 defect-class sweep** (`git grep -n "statusOf(error)" -- packages/` plus
  `git grep -n "status [=!]== [0-9][0-9][0-9]" -- packages/`, run fresh, not read from the
  SUMMARY): returns the same 9 sites the SUMMARY tables (11 individual `if` lines grouped into
  9 rows, `action/index.ts:337/386/441` sharing one `!== 200 -> setFailed` row). No untabled site
  found. Spot-checked `cleanup.ts:137` and `action/index.ts:337/386/427/441` directly -- the
  code matches the claimed reading shape in every case.
- **jq filter fixtures**: re-run independently against 7 constructed fixtures (own-ref hit with
  an older base copy, base-ref-only, push-no-base-ref, unrelated ref, empty-`.ref` row, empty
  `actions_caches` array, key-prefix-only). All three negative cases yield empty string, never a
  foreign row and never the literal `null`, matching the SUMMARY's claimed table. The
  empty-`.ref` case independently confirms the `$baseref != ""` guard is load-bearing.
- **Rename completeness**: `git grep -n "uploadFaultCode" -- packages/` returns nothing (exit 1);
  positive control `git grep -c "faultReason" -- packages/github-cache/src/publish/publish-mirror.ts`
  returns `5` (exit 0), confirming the zero is a real absence.

## Full Local Battery (re-run independently from the current working tree, not read from SUMMARY)

| Check | Result |
|-------|--------|
| `npx nx run-many -t test typecheck lint --skip-nx-cache` | `Successfully ran targets test, typecheck, lint` (printed line, not exit-code-only) -- **995 tests passed (42 files)** |
| `npm run check:action` | exit 0, `git status --short start-cache-server/index.js` empty -- no bundle drift |
| `npm run format:check` | exit 0, clean |
| `git log --oneline -3` | `ccc18c9`, `40e4d21`, `3faab10` -- three commits, matches `diff_base` `ed3b72d` |
| `git status --short` | only the untracked `.planning/quick/260803-3g1-.../` directory (this task's own docs); no scratchpad file, no leftover mutation |

## CONTEXT "Out of Scope" Compliance

| Excluded item | Touched? | Evidence |
|----------------|----------|----------|
| Mirror-vs-immutable-releases redesign | No | No architectural change to the release/mirror model; only the fault-classification path changed. |
| `dogfood-cross-os.spec.ts:349-352` OBS-04 prose | No | `git diff ed3b72d..HEAD -- dogfood-cross-os.spec.ts` shows a single hunk starting at line 530; lines 344-375 (where OBS-04 prose lives) are outside the diff. |
| `.planning/codebase/*` | No | `git diff ed3b72d..HEAD -- .planning/codebase` is empty. |
| `shardTag` / `isShardTag` / `shardTagsForWindow` | Implementation untouched | `git diff ed3b72d..HEAD -- packages/github-cache/src/lib/retention.ts packages/github-cache/src/lib/retention.spec.ts` is empty. The only references in the diff are `publish-mirror.spec.ts` importing and CALLING the existing `shardTag(NOW)` helper (to derive an expected tag string in new assertions) -- consuming the existing API, not editing the family. |

## Anti-Pattern Scan

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the 8 modified files. No
`return null`/`return {}`/`return []`/`console.log`-only stubs introduced in the diff. The two
`placeholder` string hits in `dogfood-cross-os.spec.ts` (lines 387, 795) are pre-existing
cautionary comments ("do not stub a placeholder job") outside this task's diff hunk.

## Requirements Coverage

Not applicable -- `requirements: []` in PLAN frontmatter, and no REQUIREMENTS.md entries
reference this quick task or its commits.

## Human Verification Required

None for this plan's own must_haves -- every truth was verified either by direct code/test
reading or by reproducing the claimed RED from scratch and confirming byte-exact restoration.

U1 (why `createRelease` returned 422 on run 30773689490) remains genuinely unresolved, but this
is by design: the fix is instrumentation, not a diagnosis, and the actual cause (C-TRANSIENT vs
C-NONDRAFT) can only be read off a live run. That is not a gap in this verification -- it is the
stated purpose of the fix, correctly reflected in the SUMMARY's Deferred/Watch Items table.

## Scope Note -- the milestone-level clause of the task goal

The task's goal text reads "Resolve remaining blockers and defects until milestone v0.0.2 is
fully verified." This verification confirms the plan's own must_haves (B1+B2, D1, D2) are fully
and correctly implemented. It does NOT and CANNOT confirm the milestone is "fully verified" in
the broader sense, because:

- B3 (`13-VERIFICATION.md` still reads `status: human_needed`) was deliberately left untouched --
  CONTEXT states it must be resolved by re-running verification, not by editing the frontmatter,
  and that re-run is orchestrator-owned.
- The `main`-branch verification window (push, observe run 30773689490's successor, restore
  `main`) has not occurred as part of this plan -- `execution_rules` explicitly forbid it here.
- `/gsd:audit-milestone` has not run.

Per this task's own PLAN, these are correctly out of scope for the executor and belong to the
orchestrator's next steps. This report marks the PLAN's must_haves `passed` and flags the
milestone-level clause as neither passed nor failed -- it is simply not yet evaluable until the
orchestrator completes the remaining sequence (main-branch window -> re-verify Phase 13 -> audit
milestone).

---

_Verified: 2026-08-03T01:29:41Z_
_Verifier: Claude (gsd-verifier)_
