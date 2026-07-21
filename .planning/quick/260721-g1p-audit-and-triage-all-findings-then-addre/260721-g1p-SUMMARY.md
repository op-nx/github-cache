---
quick_id: 260721-g1p
title: Address v0.0.1 PR #3 review findings
status: complete
pr: 3
branch: gsd/v0.0.1-greenfield-rebuild
verification: CI green (all 9 pull_request jobs, incl. integration matrix ubuntu + windows) on 7413363
---

# Quick Task 260721-g1p - Address PR #3 review findings

Triaged the 6-aspect PR review and fixed the substantive findings; deferred the
reviewer-hedged, low-value/high-churn items to a follow-up (user informed).

## Landed (atomic commits, all CI-green)

| Finding | Fix | Commit |
|---|---|---|
| C1 (Critical) silent write loss | capture saveCache id + lookupOnly probe -> fail closed | ff91e52 |
| I3 stdin crash | stdin 'error' listener | 4847b59 |
| I4 2 GiB operator mismatch | align mirror to server (`>`) | 45f818f |
| I2 mirror download timeout | separate larger DOWNLOAD_TIMEOUT_MS | c671357 |
| silent-failure #3 warnOnce | include numeric HTTP status | c671357 |
| silent-failure #2 all-MISS | core.warning on all-restore-MISS | 190657f |
| silent-failure #5 NaN cleanup | guard unparseable created_at | 190657f |
| silent-failure #4 sidecar port | fail loud on invalid port input | 4b1cada |
| I7/I8/statusOf dedup | GetResult re-export, SHARD_TAG_PREFIX, lib/octokit-status | 81de930 |
| type-design #4 | CacheOs union | ae1343d |
| comment-accuracy #2/#3/#5 | action.yml, github-identity, .fallowrc | ae1343d |
| I5 action-bin coverage | importable + negative tests | 97effd4 |
| I6 with-hash-lock | eviction-identity test | 97effd4 |
| I1 integration tests | real integration target + cross-OS HTTP round-trip | 7413363 |

Plus two bundle resyncs (start-cache-server/index.js) after source reformat/changes.

## Verification

- `nx run-many -t build typecheck test integration` green locally; `nx test` 342 passing (+8), integration 3 passing.
- fallow 0 issues; format:check clean; action-bundle-drift clean.
- CI: all 9 pull_request jobs green on HEAD 7413363 (run 29838584288), including the
  integration matrix now running a real cross-OS HTTP round-trip on ubuntu AND windows.

## Deferred (reviewer-hedged; follow-up)

Presented to the user for a proceed/defer decision:
- branded `Hash` type threaded through backend + naming + server (type-design #3; "marginal value bounded").
- trust/sync `{ trusted, reason }` reason-union (type-design #6; "only if the silent read-only degrade is a real support cost").
- read-only backend `put`-less split (type-design #5; "current design is defensible").
- `package.json` dependency split off the default entry (code-reviewer #6; changes the published consumer contract).
- systemic future-tense phase-comment pass (comment-analyzer #4; low value).
- cosmetic simplifications: `assertOkOrAbsent` helper, `serve.ts` spread, lazy-shard sentinel, `select-backend` shim (code-simplifier).
- ppe actionlint SHA pin, serve.ts single SIGTERM handler (code-reviewer #7/#5; small hygiene).
