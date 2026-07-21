---
quick_id: 260721-tj7
title: Apply triaged /simplify cleanup findings on PR #3
status: complete
date: 2026-07-21
branch: gsd/v0.0.1-greenfield-rebuild
commits:
  - c0ec8b6 refactor(github-cache): source MS_PER_DAY from the retention leaf
  - 56ba4ad refactor(github-cache): route the Releases read fault status through statusOf
  - 1b50719 refactor(github-cache): extract writeCountSummary for the OBS-01 tables
  - ab5553d refactor(github-cache): extract isEntrypoint for the direct-invocation guards
---

# Quick Task 260721-tj7 - Summary

## What ran

A `/simplify` review of PR #3 (`.planning/` excluded) ran 4 parallel cleanup agents
(reuse, simplification, efficiency, altitude) over the ~3k-line authored source of the
v0.0.1 greenfield rebuild. Findings were audited and triaged; the surviving quality
findings were applied as 4 bisect-safe atomic commits on the current branch via
`/gsd:quick --full --research`.

## Findings applied (4 atomic commits)

1. **c0ec8b6 - MS_PER_DAY single source.** `cleanup.ts` re-declared `MS_PER_DAY`
   identically to `retention.ts`. Exported it from the retention time-window leaf and
   imported it in cleanup. (reuse #4)
2. **56ba4ad - statusOf reuse.** The Releases reader `get()` catch hand-rolled the
   numeric-status duck-typing that `lib/octokit-status.ts`'s `statusOf` already owns
   (and the cleanup + publish engines already share). Now calls `statusOf(error)`;
   also gains a null-guard. Regenerated the action bundle. (simplify #1 / efficiency)
3. **1b50719 - writeCountSummary leaf.** The publish bin and cleanup engine authored
   the OBS-01 summary table byte-identically. Extracted `lib/summary.ts`'s
   `writeCountSummary(heading, rows)` as the single home. (reuse #3)
4. **ab5553d - isEntrypoint leaf.** The direct-invocation guard (+ Windows Pitfall-6
   rationale) was copy-pasted across `serve.ts` and the 3 bins. Extracted
   `lib/is-entrypoint.ts`'s `isEntrypoint(import.meta.url)`; updated the
   `esbuild.action.mjs` shim comment. Regenerated the action bundle. (reuse #1 /
   simplify #2 / altitude #2)

## Findings triaged out (skipped, with reason)

- **resolveWriteIdentity extraction** (altitude #1 / reuse #2): consolidating the two
  bins' fail-closed identity preamble into a github-identity.ts composite breaks the
  deliberate intra-module ESM mock seam (`action/index.spec.ts` overrides
  `resolveGitHubToken` on the module export; a composite's internal call would not be
  intercepted). Security-invariant code with per-bin fail-closed specs. Confirmed by
  the research pass.
- **server.ts switch -> ternary** (simplify #3): the `never` exhaustiveness guard is a
  deliberate compile-time tripwire; a ternary drops that future-safety.
- **Shared 2 GiB constant** (reuse #5): `MAX_CACHE_BODY_BYTES` and
  `RELEASE_ASSET_MAX_BYTES` are conceptually distinct limits that coincide today; a
  shared const would wrongly couple independent concerns.
- **publish-mirror.ts:257 redundant conjunct** (simplify #4): harmless and documents
  the all-restore-MISS invariant.
- **All efficiency findings**: the sequential publish restore is intentionally
  serialized (per-entry ~2 GiB memory ceiling + Actions-cache rate limits); the
  per-get retention recompute is negligible/deliberate.

## Verification (local CI-equivalent, all green)

- typecheck + build + test: 344/344 unit tests pass across the workspace
- integration: 3/3 pass
- `npm run format:check`: exit 0
- `npm run check:action` (action-bundle-drift): bundle in sync at HEAD
- `npm run fallow:ci` (dead-code): no issues (all 3 new leaf exports reachable)
- `npm run pack:check`: tarball ships dist/ + LICENSE + README + package.json only

## Notes

- Behavior-preserving refactors only; no correctness/behavioral change.
- Both serve()-reachable commits (56ba4ad, ab5553d) regenerated
  `start-cache-server/index.js` in the same commit, so `action-bundle-drift` stays
  clean at every commit (bisect-safe).
- One flaky unit-test blip (340/344) appeared once mid-run and cleared on re-run
  (344/344); an intermittent unhandled-rejection race unrelated to these changes.
