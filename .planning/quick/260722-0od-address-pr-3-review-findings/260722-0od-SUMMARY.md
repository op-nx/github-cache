---
phase: quick-260722-0od
type: summary
status: complete
requirements_addressed:
  [
    F01,
    F02,
    F03,
    F04,
    F05,
    F06,
    F07,
    F08,
    F09,
    F10,
    F11,
    F12,
    F13,
    F14,
    F15,
    F16,
    F17,
    F18,
    F19,
    F20,
    F21,
    F22,
    F23,
    F24,
    F25,
    F26,
    F27,
  ]
final_test_count: 430
baseline_test_count: 384
---

# Quick Task 260722-0od: Address PR #3 review findings - Summary

## Outcome

The 27 upheld findings from the PR #3 multi-agent review are landed as bisect-safe
atomic commits on `gsd/v0.0.1-greenfield-rebuild`. Every commit is independently
green across the full battery (`format:check`, `build`, `typecheck`, `test`,
`fallow:ci`, `check:action`, `pack:check`; plus `typecheck:action` from Task 15
onward). Test count rose from the 384 baseline to **430** (every behavioral fix
landed with a test proven to redden first).

`npm run check:action` exits **0** at the final HEAD (bundle in sync).
`npm run typecheck:action` exits **0** at the final HEAD.

## Task -> commit mapping

| Task | Finding(s) | Commit | Subject |
|------|-----------|--------|---------|
| 1 | F01 | c0d1ebf | fix(backend): answer 409 on an ambiguous saveCache no-op |
| 2 | F02 | 263b512 | fix(backend): move the per-hash lock to the module that owns the archive path |
| 3 | F14, F19 | 1a874a1 | fix(server): answer 405 for a route-matched unsupported method (also tightened both 413 specs to unconditional) |
| 4 | F18 | 1ca8c14 | fix(serve): close idle connections and await the close during shutdown |
| 5 | F06 | 97fb4dd | fix(action): fail fast when the sidecar port input is omitted |
| 6 | F23 | ff92594 | fix(local-context): match the github.com host case-insensitively |
| 7 | F07, F08 | 3a56c30 | fix(cleanup): narrow the sync gate to schedule and warn on a gated-out skip |
| 8 | F15, F24 | 65cc7dd | test(docs): guard versioning.md env knobs and anchor the fixed-limit claim |
| 9 | F09 | dc7431a | feat(retention): refuse a sub-7-day retention policy unless opted in |
| 10 | F04 | 4acbafd | feat(octokit): retry and throttle transient GitHub API faults |
| 11 | F13 | d328dbf | fix(publish): count an oversized entry instead of aborting the loop |
| 12 | F05 | 9d4d0f1 | fix(roundtrip): byte-compare the read-back payload |
| 13 | F10 | 72dff27 | fix(ppe): check the actionlint installer exit and guard the audit binary |
| (13b) | -- | c9ffbf4 | test(backend): make the same-hash serialization specs timer-free (flake hardening; see Deviations) |
| 14 | F16, F25 | d80a402 | fix(package): exclude internal dist subtrees from the tarball and declare engines |
| 15 | F12, F27 | 5053f95 | ci: type-check the committed bundle and smoke-test it as shipped |
| 16 | F17 | a89e7de | fix(docs): mask the sidecar bearer token before writing $GITHUB_ENV |
| 17 | F11, F26 | a92a7f6 | docs: document the four-branch backend selection and publish concurrency |
| 18 | F03, F20, F21, F22 | 4c64aff | docs(rationale): correct stale and misattributed code comments |
| 3a | F14 (413-flush half) | cb2832d | docs(server): document the 413-flush HTTP/1.1 limitation at the destroy sites (comment-only; see Deviations) |
| 19 | -- | (orchestrator) | STATE.md bookkeeping + SUMMARY (this file); docs committed by the orchestrator |

Final code HEAD: **cb2832d**. Baseline (task start): 7084662.

## Findings disposition notes

- **F20 (CVE misattribution): MOOT, no edit.** Confirmed `git grep -n "36852" --
  packages/github-cache/src/` returns nothing (exit 1). The identifier appears only
  in `.planning/` prose, where it is correct. No manufactured edit.
- **F14: 405 half FIXED; 413-flush half DOWNGRADED to a documented limitation, NOT
  fixed.** The 405 restoration (F19) landed in 1a874a1. The 413-flush half is an
  inherent HTTP/1.1 limitation (see Deviations 1); it is documented with a
  `ponytail:` ceiling comment at both destroy sites (cb2832d), with NO behavior
  change. In any PR-body finding table, #14 reads "405 fixed; 413-flush documented
  as inherent HTTP/1.1 limitation" -- never "fixed". The tightened 413 assertions
  (unconditional `status === 413`) from 1a874a1 stay green for the finite-body
  cases the specs exercise, and the mid-stream abort test
  (`server.spec.ts` "aborts a streamed body exceeding the cap without buffering it")
  still asserts the over-cap stream is rejected with `putCalled === false` -- the
  load-bearing memory-bound invariant (backend.put, hence the full-body
  Buffer.concat, is never reached) -- and stays green.

## Deviations from the plan

1. **Task 3(a) -- the 413 flush fix was NOT applied; resolved as a documented
   limitation (lead-approved).** Per the plan's redden-first stop condition, the two
   413 specs were tightened first; they did not redden against the current server
   via `fetch` with a small body. A subsequent authorized raw-socket investigation
   (probes retained in the session scratchpad) found:
   - The reset IS deterministic: a client streaming a body far larger than the cap
     observes ECONNRESET, not 413 (raw net.Socket 60/60; `fetch` 32 MiB stream
     ~100%). Threshold on the committed code: a finite body <=16 KB over the cap
     delivers a clean 413 (100%); >=256 KB over the cap resets (100%).
   - The prescribed destroy-on-finish fix does NOT resolve it (still ~100%
     ECONNRESET) and one variant leaves connections hanging (unsettled awaits).
     FIN-on-finish and drain-then-close also fail (~100% ECONNRESET).
   - Conclusion: delivering a clean early 413 to a client actively streaming a body
     far over the cap is an inherent HTTP/1.1 limitation, not a fixable code defect.
     Since the real cap is 2 GiB, any genuinely over-cap PUT is always in the
     large-stream band and resets regardless. The cap's actual purpose (bounding
     memory via the cap check before `Buffer.concat`) is intact either way.
   - Lead approved option (a): keep the committed behavior, add a `ponytail:`
     ceiling comment at both destroy sites (landed cb2832d), no code behavior change,
     no large-stream 413 test. Comment-only, so no bundle diff (esbuild strips
     comments) -- server.ts committed alone.

2. **Flake-hardening follow-up commit (c9ffbf4), beyond the 19 numbered tasks.**
   The same-hash serialization specs added in Task 2 used a fixed `setTimeout(0)`
   tick that flaked once under parallel CPU contention. Hardened to a timer-free
   entry-count tracker (deterministic; 5 runs green; still reddens without the
   lock). Landed as its own commit rather than amending Task 2's landed commit.

3. **Task 16 touched docs/examples/minimal-ci.yml, beyond the plan's explicit file
   list.** It carries the same token-to-$GITHUB_ENV copy-paste pattern and is
   scanned by the new add-mask guard, so masking it was required by the root-cause
   fix.

4. **Task 5 coverage is source-level, not behavioral.** The CI typecheck rejects a
   behavioral cross-rootDir import of entry.ts (TS6059/TS6307), so the port-guard
   coverage landed as source-level assertions in consumer-action-runtime.spec.ts --
   the plan's documented fallback ("a source-level assertion on the guard is
   acceptable if a behavioral import is not possible").

## LOCKED decisions honored

- 409 (not fork detection) for the ambiguous cache-write denial.
- `merge_group` NOT re-added to the trust allowlist (F03 comment only).
- Retention floor is a policy floor + opt-in override, NOT a ratio circuit breaker.
- `isTrustedSyncEvent` narrowed to the literal `schedule`, NOT replaced with
  `isSyncTrusted`.
- `server.ts` read-fault-to-404 (SRV-05) unchanged.
- `cache-archive-path.ts` path string comment-locked; cross-process leg documented,
  not locked.
- No `v0` tag created or pushed (recorded as a Deferred Items release-checklist row).

## Supply chain

Two exact-pinned deps added (Task 10): `@octokit/plugin-retry@8.1.0`,
`@octokit/plugin-throttling@11.0.3`, both governed by `pinned-deps.spec.ts`. The
lockfile was regenerated in a linux/arm64 `node:24` container and the diff verified
additive-only (the two plugins + `bottleneck@2.19.5`, correct core-7 peer ranges,
zero removed lines); `npm ci` then installed locally without rewriting the lockfile.
No Windows-pruned lockfile.

## Final local battery (complete series, at HEAD cb2832d)

| Command | Exit |
|---------|------|
| `npm run format:check` | 0 |
| `npm run build` | 0 |
| `npm run typecheck` | 0 |
| `npm run typecheck:action` | 0 |
| `npm run test` | 0 (430 passed) |
| `npm run fallow:ci` | 0 |
| `npm run check:action` | 0 |
| `npm run pack:check` | 0 |

## Not completed / held

- **The branch push is deliberately HELD.** The team lead is handling the
  outward-facing push and the PR-body update independently after verifying this
  series. This executor did not push and did not touch the PR body.
