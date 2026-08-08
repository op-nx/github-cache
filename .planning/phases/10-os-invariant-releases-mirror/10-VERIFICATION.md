---
phase: 10-os-invariant-releases-mirror
verified: 2026-07-29T00:00:00Z
status: passed
score: 13/13 code-level must-haves verified; 3 Live-CI-only items outstanding by design (not gaps)
behavior_unverified: 0
overrides_applied: 0
live_ci_only_items:
  - test: "Push to main, then read the ubuntu publish leg's OBS-01 summary and the shard census for cache-mirror-<YYYYMM>."
    expected: "Nonzero mirrored count, readMisses 0, no all-restore-MISS warning; nx-cache-* names present; legacy <hash>-<os> names stop growing (CORR-02 warm-mirror precondition owed to Phase 11)."
    why_not_pre_merge: "publish / publish-verify are push-gated to main; no PR run samples them at any rate (by design)."
  - test: "Read both publish-verify leg logs after the same push."
    expected: "publish-verify (windows-11-arm) logs a windows-produced payload and label mirrored-by: windows; publish-verify (ubuntu-24.04-arm) logs linux for both; publish (windows) summary reports mirrored: 1, not 0 (OBS-05)."
    why_not_pre_merge: "Same push-gate; OBS-05's live half cannot run pre-merge."
  - test: "Confirm publish in the same push only starts after integration (windows-11-arm) completes, and the resulting census contains no task hash mirrored under only one OS's production (XOS-07 full-task-set mirror)."
    expected: "publish starts after integration (windows-11-arm); census shows the Windows integration hash mirrored by the ubuntu leg too."
    why_not_pre_merge: "Same push-gate; this is the requirement's own designed proof shape."
---

# Phase 10: OS-Invariant Releases Mirror -- Verification Report

**Phase Goal:** One asset name per hash with no OS component -- still prunable, still
attributable to its producer, and with the trust consequences of collapsing two namespaces
into one classified by an auditor rather than assumed away.

**Status:** passed. All 13 code-level must-haves this session set out to check are VERIFIED
against the actual code (not against SUMMARY.md prose), including two independently-run
end-to-end mutation tests that prove two different guards genuinely bite. The only items
still outstanding are the 3 Live-CI-only observations that this phase's own design makes
unclosable pre-merge (push-gated to `main`) -- they are recorded below, not treated as gaps.

## Round 2: closing the three `## Uncertain` rows from the first pass

### #11 OBS-03 -- VERIFIED (was Uncertain)

Read `packages/github-cache/src/publish/publish-mirror.ts` and
`packages/github-cache/src/action/index.ts` directly.

- **4th positional argument, confirmed:** `const label = \`mirrored-by: ${cachePlatform()}\`;`
  hoisted above `for (const hash of hashes)`, passed as
  `client.uploadReleaseAsset(shard.id, name, bytes, label)`.
- **Real Octokit adapter forwards it, confirmed:** `action/index.ts`'s
  `uploadReleaseAsset(releaseId, name, bytes, label)` passes `label` straight into the
  `octokit.rest.repos.uploadReleaseAsset({ ..., label, ... })` call object, alongside `name`.
- **Hoist guarded by a case that reddens if moved back inside the loop -- INDEPENDENTLY
  MUTATION-TESTED.** I moved the `const label = ...` line from above the loop to the first
  statement inside it (a real edit to `publish-mirror.ts`, via a scratch script, not just
  reading the plan's claim), ran `npx vitest run ... publish-mirror.spec.ts`: **exactly 1 of
  28 tests failed** -- `calls cachePlatform exactly ONCE per run (the hoist), stamping both
  uploads with the same label` -- and all 27 others stayed green. Reverted with
  `git checkout --`, re-ran: 28/28 green, tree clean. This is the second independently
  reproduced mutation test in this verification (the first was XOS-07's `needs:` guard in
  the prior session).

### #12 CORR-05 -- VERIFIED (was Uncertain)

Read `packages/github-cache/src/lint-rules.spec.ts` and
`packages/github-cache/src/backend/releases-backend.spec.ts` directly.

- **`CORR_05_SITES` emptied to zero rows, confirmed:** `const CORR_05_SITES = [] as const;`
- **Positive assertion present, confirmed:** `expect(CORR_05_SITES).toEqual([])` under
  `it('CORR-05 is now TRUE: zero extant ambient-platform reads remain in unit specs', ...)`
  -- closes the zero-row `for...of` silent-cliff exactly as claimed.
- **Historical block survived, confirmed:** the file still carries the full HISTORICAL doc
  block recording the original 4-site count, the `cache-archive-path.spec.ts` removal in
  Phase 9, and the two recorded miscounts (the `tmpdir()` call-vs-position distinction, and
  ROADMAP SC3's "three violations" miscount).
- **No row repointed, confirmed:** the table is fully empty (all three rows removed together
  with their sites), not repointed at the new `release-asset-name.integration.spec.ts` path --
  reading the doc block confirms the moved case is described as landing at the exempt
  integration path while its `CORR_05_SITES` row was deleted, not retargeted. The enumeration
  helpers (`readSiteLines`, `lineIndexOf`) were removed along with the rows, not left as dead
  machinery.
- **`releases-backend.spec.ts` non-vacuity replacement, confirmed present and correctly
  shaped:** `createReleasesReadBackend name derivation (TEST-05)` asserts
  `client.requested` deep-equals `[releaseAssetName('abc123' as Hash)]` (exactly one
  requested name, equal to the helper's output), then loops the WHOLE `CACHE_OS_VALUES`
  tuple asserting `client.requested[0]` does not contain any member -- tuple-driven, not a
  hand-authored `'linux'` check (the exact G2 shape this phase guards against).

### #13 TRUST-10 -- VERIFIED (was Uncertain)

Re-ran the diff myself rather than trusting the recorded transcript:

```
git diff --stat 06019d4..HEAD -- packages/github-cache/src/lib/trust.ts packages/github-cache/src/lib/sync-gate.ts
```

**Output: empty. Exit 0.** C1 (write-trust allowlist) and C2 (sync gate) are confirmed
byte-identical from before this phase's planning began through HEAD, independently
reproduced, not merely read from `10-TRUST-EVIDENCE.md`.

Read `packages/github-cache/src/action/index.spec.ts` directly (located by the phrase
`Scope to`, not a line number): the `createPublishClient.listCacheEntries ref scoping
(TRUST-10)` describe asserts the WHOLE `paginate.mock.calls[0]` array via `toEqual` --
endpoint sentinel plus `{ owner, repo, ref, per_page: 100 }` -- driven with two distinct
constructor `ref` values, PLUS a separate `expect(paginate).toHaveBeenCalledOnce()` case
pinning the call count. Matches the claimed shape exactly: a property-only assertion would
miss a dropped sibling option or a second unscoped call; this doesn't.

## Full must-have table after round 2

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CORR-02: `releaseAssetName(hash)` = `nx-cache-<hash>`, no OS, single-sourced, arity 1 | VERIFIED | Code read directly (round 1) |
| 2 | RETAIN-04: cleanup filter admits both name families, same commit as CORR-02 | VERIFIED | Code read + `git rev-list --count b37a358..77f675c` = 1 (round 1) |
| 3 | RETAIN-05(a)(b)(c): tar.gz disposition, mutual exclusivity, 4-consumer lock | VERIFIED | Code + evidence doc read directly (round 1) |
| 4 | XOS-07: `publish` waits on all 4 producer jobs, guard not superset-vulnerable | VERIFIED BY MUTATION TEST | Reverted `needs:` to `build`, ran suite myself: exact predicted 3-of-4 split (round 1) |
| 5 | XOS-06: `max-parallel: 1` retained, comment-locked as not a correctness control | VERIFIED | Guard read directly (round 1) |
| 6 | OBS-05: per-leg seed, tightened single-producer read-back, `mirrored-by` dead-leg detector | VERIFIED | `read-back.ts`/`.spec.ts` read in full (round 1) |
| 7 | TRUST-11/TRUST-12: recorded as QUESTIONS, proposed classification labelled INPUT not conclusion | VERIFIED | `10-TRUST-EVIDENCE.md` Part B read in full; commit range independently re-derived (round 1) |
| 8 | TRUST-13: not self-certified, still open | VERIFIED | Checkbox unticked; no `10-SECURITY.md` on disk; process constraint documented (round 1) |
| 9 | Five same-commit rules held in git | VERIFIED | `git rev-list --count` + `git show --name-only` on `77f675c` (round 1) |
| 10 | XOS-02 baseline captured pre-rename (Phase 11 precondition) | VERIFIED | `10-EVIDENCE-PRE-RENAME.md` read in full (round 1) |
| 11 | OBS-03: `mirrored-by: <os>` stamped as 4th positional arg, adapter forwards it, hoist guarded | VERIFIED BY MUTATION TEST | `publish-mirror.ts` + `action/index.ts` read directly; hoist-move mutation test (round 2) |
| 12 | CORR-05: `CORR_05_SITES` empty, positive assertion present, historical block survives, no repointing, non-vacuity replacement present | VERIFIED | `lint-rules.spec.ts` + `releases-backend.spec.ts` read directly (round 2) |
| 13 | TRUST-10: C1/C2 unchanged, `ref` scoping pinned with whole-array + count assertions | VERIFIED | Diff independently re-run (empty); `action/index.spec.ts` read directly (round 2) |

**13/13 code-level must-haves VERIFIED**, two of them by independently-reproduced mutation
tests (XOS-07's `needs:` guard, OBS-03's `cachePlatform`-hoist guard) rather than by reading
claims. No FAILED items. No new defects found while closing the Uncertain rows.

## Live-CI-only items (recorded, not gaps -- correctly outside pre-merge reach)

| # | Item | Owning plan | What a real runner must show | Falsifier |
|---|------|-------------|-------------------------------|-----------|
| L1 | Per-leg own-asset read-back with `mirrored-by` label | 10-05 | `publish-verify (windows-11-arm)` logs a windows payload + label `mirrored-by: windows`; ubuntu leg logs `linux` for both; `publish (windows)` reports `mirrored: 1`, not 0 | Either leg reading the other's asset, a MISS on a leg whose publish succeeded, or `mirrored: 0` on windows |
| L2 | Post-widening full-task-set mirror | 10-03 | `publish` starts only after `integration (windows-11-arm)` completes; census shows the Windows `integration` hash mirrored by ubuntu too | `publish` starting before `integration` finishes, or a hash produced only on Windows absent from ubuntu's mirrored set |
| L3 | Warm-mirror republish under the new name (gates Phase 11) | 10-07 | Ubuntu leg's summary: nonzero `mirrored`, `readMisses` 0, no all-restore-MISS warning; census shows `nx-cache-*` present, legacy names stop growing | `mirrored: 0` with `readMisses` equal to `scanned` |

All three are `push`-gated to `main` by this phase's own design; no PR run samples them at
any rate, so no pre-merge check could close them without passing for the wrong reason. This
is the correct, expected shape for this phase -- not a verification gap.

## Requirements checkbox sanity (REQUIREMENTS.md)

Ticked (10): CORR-02, CORR-05, RETAIN-04, RETAIN-05, OBS-03, XOS-06, XOS-07, TRUST-10,
TRUST-11, TRUST-12 -- all 10 now directly code-verified this session (7 in round 1, 3 more
in round 2). Not ticked (2, correctly): OBS-05 (live per-leg read-back is push-gated --
code-level guard fully verified, live half is L1 above), TRUST-13 (auditor has not run).

## Anti-pattern scan

Repo-wide `rg` scan for `toHaveBeenCalledWith(expect.not` (Phase 9 gap G3 shape): one hit,
in `publish-mirror.spec.ts`, confirmed by reading context to be inside an explanatory
comment describing why that shape is NOT used (the real assertion is
`.not.toContainEqual(...)` plus a separate call-count pin). No live G3 violation found.
`'linux'` literal scan across phase-10 spec files: one intentional, well-commented use in
`action/index.spec.ts` for a pre-existing, genuinely single-leg job (`dogfood-seed`/-verify,
Phase 9), not a new G2 violation.

## Gaps

None. Every item checked across both rounds matched its claim, including two independently
reproduced mutation tests. Nothing FAILED.

## What remains genuinely unchecked (smaller than before, stated for completeness)

- 6 of 8 plan `SUMMARY.md` files still not read (only `10-07-SUMMARY.md` was; all 8
  `PLAN.md` files were read in full, which is the stronger artifact anyway).
- `mirror-seed.ts`, `mirror-seed.spec.ts`, `cleanup.ts`, `cleanup.spec.ts`,
  `docs-same-os-claims.spec.ts` were not opened this session. Nothing in the coordinator's
  round-2 scope touched these, and nothing surfaced elsewhere in this verification calls
  their correctness into question.
- The stale-prose sweep (verify-hardest item 9) was not independently re-swept end-to-end
  beyond what round 1 and round 2 directly touched.
- `10-VALIDATION.md`'s `status: draft` / all-`[ ] pending` state is correct sequencing per
  the coordinator: `/gsd:validate-phase` runs after this verification and owns flipping
  those fields. Not a defect.
- The `[W0]` count difference (14 counted vs "ten" in the original dispatch) is the
  coordinator's own bullet-count vs. per-task-table-marker-count difference, not a defect;
  the table is the source of truth.

None of the above blocks `passed` status: they are either out of this round's scope, or
explicitly deferred to downstream gates (`/gsd:secure-phase`, `/gsd:validate-phase`) that
will independently exercise much of that same surface.

---

_Verified: 2026-07-29 (two rounds; round 1 interrupted by a spend-limit reset and resumed,
round 2 closed all three Uncertain items with direct code reads and two independent
end-to-end mutation tests)_
_Verifier: Claude (gsd-verifier)_
