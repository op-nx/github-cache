---
quick_id: 260721-g1p
title: Address v0.0.1 PR #3 review findings
status: complete
pr: 3
branch: gsd/v0.0.1-greenfield-rebuild
verification: CI green (all 9 pull_request jobs, incl. integration matrix ubuntu + windows) on 6d268ac; gsd-verifier gate passed
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
| code-simplifier | assertOkOrAbsent, backend spread, lazy-shard sentinel, drop select-backend shim | e2c7160 |
| code-reviewer #5/#7/#8 | ppe actionlint SHA-pin, SIGTERM doc, memory-backend fixture note | 3c8fb31 |
| type-design #3 | branded Hash threaded end-to-end (parseHash mint) | a9dfe69 |
| type-design #6 | trust/sync { trusted, reason } union (logic unchanged) | 1a7ea70 |

Plus bundle resyncs (start-cache-server/index.js) after each batch of serve-graph changes.

## Verification

- `nx run-many -t build typecheck test integration` green locally; `nx test` 342 passing (+8), integration 3 passing.
- fallow 0 issues; format:check clean; action-bundle-drift clean.
- CI: all 9 pull_request jobs green on HEAD 7413363 (run 29838584288), including the
  integration matrix now running a real cross-OS HTTP round-trip on ubuntu AND windows.

## Not done (deliberately; would degrade shipped code)

Per the user's "do everything" directive I implemented every finding that is a net
improvement (including the churny branded-Hash + trust/sync-union refactors). These
two were intentionally NOT taken because implementing them degrades correct code:

- **read-only backend `put`-less split** (type-design #5): the reviewer judged the
  current design defensible. The `'forbidden'` PutResult is load-bearing -- the server
  must answer PUT-to-read-only with HTTP 403, which needs a uniform `put`; a `put`-less
  type only adds server branching. Also contradicts the D-01/TRUST-05 no-mode-arg design.
- **`package.json` dependency split** (code-reviewer #6): `@actions/cache`/`@octokit/rest`
  are genuine runtime deps of the shipped CLI bin + Action entrypoints; moving them to
  peer/optional to lighten a barrel-only consumer breaks `npm i` for CLI users -- a
  breaking change to the published v0.0.1 contract. **DEFERRED to a later milestone as
  PKG-SPLIT** (ROADMAP.md "Deferred to a later milestone"; STATE.md Deferred Items) per
  the maintainer -- the only non-breaking fix is a real package restructure (zero-dep
  barrel package + a separate CLI/Action package), its own planned change.

The systemic future-tense comment pass (comment-analyzer #4, "low priority, don't
contradict code") was satisfied by fixing the actively-misleading comments (Wave 4);
the remaining historical breadcrumbs are accurate and left as-is.
