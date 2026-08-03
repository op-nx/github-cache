---
phase: 260803-fcd
verified: 2026-08-03T13:30:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Quick Task 260803-fcd: burned-name skip, then the nx-cache namespace - Verification Report

**Task goal:** Phase A burned-name skip, Phase B nx-cache- prefix, verified live
**Verified:** 2026-08-03T13:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from PLAN.md must_haves.truths)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A burned month-shard tag makes the publish leg SKIP loudly and exit 0: skipped==scanned, mirrored==0, failed==0, setFailed not called | VERIFIED | `publish-mirror.spec.ts` clause "SKIPS the whole shard ONCE..." passes (45/45 in file); reproduced by running the spec directly. Live-CI confirmed: run `30803953260` job 91655727746/91655727717 both `publish` legs SUCCESS with `##[warning]...cannot be created -- GitHub rejected the tag name (status 422, message tag_name was used by an immutable release)...`, and `publish-verify` failed with `cache MISS` (expected D5 shape) |
| 2 | Exactly ONE createRelease attempt and ONE core.warning per burned-shard run, independent of hash count | VERIFIED | A1 test uses 3 distinct hashes and asserts `toHaveBeenCalledOnce()` on both `createRelease` and `core.warning`; test passes. Live-CI: `rg -c "cannot be created -- GitHub rejected"` on both leg logs of run 30803953260 returns exactly 1 each |
| 3 | A 422 carrying only the pre_receive ruleset entry still FAILS the publish job (decoy stays fatal) | VERIFIED | A2 test passes now; **mutation-reproduced independently**: replacing the burned-name predicate with a status-only `statusOf(error)===422` reading reddens exactly this clause (`still FAILS the run on a 422 carrying ONLY the pre_receive...`) among 11 failures. Restored byte-exact (`git hash-object` = `a04f1bc5...` before and after, `git diff --quiet` clean) |
| 4 | A 422 whose tag_name entry is reworded past 'immutable release' still FAILS the job, fatal log names tag_name entry not the decoy | VERIFIED | A3 test passes; same mutation run above reddens this clause too. Code reads `faultMessageForField(error, 'tag_name')` for the fatal log (`publish-mirror.ts:238`), not `reason.message` alone |
| 5 | shardTag() produces nx-cache-YYYYMM and isShardTag accepts exactly that shape | VERIFIED | `retention.ts:62` `SHARD_TAG_PREFIX = 'nx-cache-'`; `retention.spec.ts` pins `shardTag(...)` to `'nx-cache-202607'` etc.; full suite passes (1011/1011). Live-CI: release `nx-cache-202608` (id 364151911) exists with 69 assets, confirmed via `gh api repos/op-nx/github-cache/releases` |
| 6 | Non-shard rejection fixtures fail on the 6-digit SUFFIX, not a prefix mismatch — proven by loose-prefix mutation reddening both blocks | VERIFIED | **Mutation reproduced independently**: dropped the `\d{6}` suffix from `SHARD_TAG_PATTERN` (`new RegExp('^' + SHARD_TAG_PREFIX)`); ran `retention.spec.ts` + `cleanup.spec.ts` -- 9 failed / 39 passed, exactly the 7 rebased trap-1 fixtures + the "derives from..." pin + the trap-2 cleanup clause. `v1.0.0` stayed green (confirmed by name in per-test output). Restored byte-exact (hash `39f9e3c0...` matches before/after, `git diff --quiet` clean) |
| 7 | Generated action bundle carries the new prefix in the SAME commit as the source rename | VERIFIED | `git show a1d6139 -- start-cache-server/index.js` shows `SHARD_TAG_PREFIX` changed from `cache-mirror-` to `nx-cache-` in the identical commit as `retention.ts`'s source change. `npm run check:action` run fresh from current tree: exit 0, no drift (`git status --porcelain` empty after) |
| 8 | Phase A and Phase B are two separate commits, A first | VERIFIED | `git log --oneline`: `1e5bc10` (Phase A, fix(publish)) precedes `a1d6139` (Phase B, refactor(retention)); `git merge-base --is-ancestor 1e5bc10 a1d6139` confirms ancestry |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/github-cache/src/lib/octokit-fault-reason.ts` | field-scoped accessor `faultMessageForField` | VERIFIED | Exists, exported, filters `entry.field === field` then maps to string message — structurally cannot read the pre_receive decoy |
| `packages/github-cache/src/publish/publish-mirror.ts` | burned-name branch + one-shot sentinel + fixed fatal log | VERIFIED | `ensureShardRelease` returns `number \| undefined`; `burnedShardTag` sentinel skips remaining hashes with no further API call; fatal log at line 238 uses `faultMessageForField(...) ?? reason.message` |
| `packages/github-cache/src/publish/publish-mirror.spec.ts` | A1/A2/A3 clauses, existing clauses intact | VERIFIED | All three new clauses present and pass; both pre-existing `already_exists` and UNREADABLE-body clauses still present and pass (45/45 total) |
| `packages/github-cache/src/lib/retention.ts` | SHARD_TAG_PREFIX = 'nx-cache-' | VERIFIED | Confirmed at line 62; CACHE_MIRROR_MAX_AGE_DAYS/CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION untouched (D3 respected) |
| `packages/github-cache/src/lib/retention.spec.ts` | rebased pins + trap-1 fix | VERIFIED | All pins use `nx-cache-`; trap-1 REJECT list rebased with `v1.0.0` left as the deliberate foreign-tag exception |
| `packages/github-cache/src/cleanup/cleanup.spec.ts` | trap-2 fix, test-name rewrite | VERIFIED | Fixtures use `nx-cache-latest`/`nx-cache-backup`; test names at lines 122/140 read the new prefix; historical MEASURED census at line 212 kept verbatim with marker |
| `start-cache-server/index.js` | regenerated bundle | VERIFIED | Line 68503 reads `var SHARD_TAG_PREFIX = "nx-cache-";`; `check:action` exits 0 against current tree |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `faultMessageForField(error, 'tag_name')` | burned-name predicate in `ensureShardRelease` | direct call, `publish-mirror.ts:203-215` | WIRED | Confirmed by reading the source; the decoy is excluded both structurally (field mismatch) and textually (no substring match) |
| `burnedShardTag` sentinel | lazy shard resolve loop | `if (burnedShardTag) { skipped++; continue; }` before any `ensureShardRelease` call | WIRED | Confirmed one createRelease/one warning per leg, both in unit test (3-hash fixture) and live CI (`rg -c` = 1 on both legs of run 30803953260) |
| `SHARD_TAG_PREFIX` | `SHARD_TAG_PATTERN` | `new RegExp('^' + SHARD_TAG_PREFIX + '\\d{6}$')`, `retention.ts:79` | WIRED | Single source, one-home rule intact; bundle preserves the derivation (both `shardTag` and `SHARD_TAG_PATTERN` read the constant in `start-cache-server/index.js`) |
| `SHARD_TAG_PATTERN` | `isShardTag` | `SHARD_TAG_PATTERN.test(tag)`, `retention.ts:99` | WIRED | Cleanup scope filter uses the exact accepter, not a loose prefix (mutation-proven) |

### Behavioral Spot-Checks (mutation reproductions, independent of SUMMARY.md claims)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full spec suite for publish-mirror pre-mutation | `npx nx test github-cache --skip-nx-cache -- src/publish/publish-mirror.spec.ts` | 45 passed (45) | PASS |
| Status-only mutation reddens A2+A3 | mutated predicate to `statusOf(error)===422`, ran same spec | 11 failed / 34 passed, includes both A2 and A3 clauses by name | PASS (matches SUMMARY claim exactly) |
| Restore byte-exact after Phase A mutation | `git hash-object` before/after + `git diff --quiet` | hash `a04f1bc5...` matches both times; diff clean | PASS |
| Loose-prefix mutation reddens both traps | dropped `\d{6}` from `SHARD_TAG_PATTERN`, ran `retention.spec.ts` + `cleanup.spec.ts` | 9 failed / 39 passed; `v1.0.0` stayed green | PASS (matches SUMMARY claim exactly) |
| Restore byte-exact after Phase B mutation | `git hash-object` before/after + `git diff --quiet` | hash `39f9e3c0...` matches both times; diff clean | PASS |
| Full suite post-restore | `npx nx test github-cache --skip-nx-cache` | 42 files / 1011 tests passed | PASS |
| typecheck + lint | `npx nx run-many -t typecheck lint --projects=github-cache --skip-nx-cache` | both target lines printed, ran successfully | PASS |
| Bundle drift check | `npm run check:action` | exit 0, `git status --porcelain` empty after | PASS |
| format-check | `npm run format:check` | exit 0 | PASS |
| Residual sweep | `git grep -c -F "cache-mirror" -- . ':!.planning'` + `rg -c -F "cache-mirror" start-cache-server/index.js` | Matches expected table exactly: publish-mirror.ts 1, read-back.ts 3, read-back.spec.ts 1, cleanup.spec.ts 1, bundle 0 (rg exit 1) | PASS |

### Live-CI Verification (independent of "already in hand" claims — re-checked via `gh api`/`gh run`)

| Claim | Verification | Result |
|-------|--------------|--------|
| Window A (run 30803953260, commit 1e5bc10): publish SUCCESS both legs, one warning each | `gh run view 30803953260` job list + log grep | Both `publish` legs SUCCESS; exactly 1 matching warning line per leg log |
| Window A: publish-verify FAILURE (correct per D5) | `gh run view` job list + log tail | `publish-verify (ubuntu-24.04-arm)` FAILED with `cache MISS for feed230803953260` -- expected shape, not a defect |
| Window A: format-check FAILURE (fixed by 70064f5) | `gh run view` job list | `format-check` job marked X (failed) |
| Window B (run 30807461616, commit 70064f5 tip): FULL GREEN | `gh run view 30807461616` job list | All 26 jobs SUCCESS, including both `publish` and both `publish-verify` legs |
| Fresh `nx-cache-202608` shard, 69 assets | `gh api repos/op-nx/github-cache/releases` + `/releases/{id}/assets` | Release id 364151911, tag `nx-cache-202608`, 69 assets -- exact match |
| Legacy `cache-mirror-202607` release+tag deleted (Phase C) | `gh api .../releases` (absent from list) + `gh api .../git/refs/tags/cache-mirror-202607` | Release absent from the releases list; ref lookup returns 404 |

### CONTEXT OUT-list Compliance

| Item | Expected | Status |
|------|----------|--------|
| `CACHE_MIRROR_MAX_AGE_DAYS` / `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION` | NOT renamed (D3) | VERIFIED — both spellings intact in `retention.ts` |
| `ROADMAP.md` | untouched | VERIFIED — empty `git log`/`git diff` for ROADMAP.md across the commit range |
| Historical measurement records | kept verbatim, marker added, no blanket rename | VERIFIED — residual sweep table matches exactly (4 files, exact counts); each surviving line carries the tag names verbatim plus a "(the PRE-RENAME tag scheme)" marker in the same comment block |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers introduced in any modified file. No stub implementations, no empty handlers, no hardcoded-empty-data patterns in the modified files.

### Requirements Coverage

Not applicable — quick task, no ROADMAP phase or REQUIREMENTS.md rows (per PLAN.md's own source_audit note).

### Human Verification Required

None. All must-haves resolved to VERIFIED via direct code reading, independent mutation reproduction with byte-exact restore, and independent live-CI re-verification via `gh api`/`gh run view` (not just re-reading SUMMARY.md's claims).

### Gaps Summary

No gaps found. One minor, non-blocking observation outside the plan's scope: `.planning/STATE.md`'s "Current Position" narrative section (lines 28-37) still reads "the merge is still BLOCKED on the `publish-verify` regression (PR #16)" — stale text from a prior session that the orchestrator's `45f5bb2` STATE.md update did not touch (it updated the quick-task log table, the deferred-items table, and a separate blocker-status bullet further down, but not this earlier narrative paragraph). PLAN.md explicitly marks STATE.md as "NOT IN THIS PLAN (orchestrator-owned)", so this is not a plan must-have and does not affect the phase goal (code-level burned-name skip + prefix rename, verified live). Flagged for awareness only, not as a gap requiring a closure plan.

---

_Verified: 2026-08-03T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
