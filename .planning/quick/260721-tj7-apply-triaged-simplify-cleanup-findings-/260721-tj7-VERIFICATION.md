---
quick_id: 260721-tj7
title: Apply triaged /simplify cleanup findings on PR #3
kind: verification
date: 2026-07-21
branch: gsd/v0.0.1-greenfield-rebuild
range: 8d3ff01..HEAD
status: passed
---

# Verification: Quick Task 260721-tj7

Goal-backward check of the four triaged `/simplify` cleanup findings applied as
atomic commits. Verified against the actual codebase and git, not merely that the
commits exist. Verdict: **passed**.

Commit range (`git log --oneline 8d3ff01..HEAD`):

- `c0ec8b6` refactor: source `MS_PER_DAY` from the retention leaf
- `56ba4ad` refactor: route the Releases read fault status through `statusOf`
- `1b50719` refactor: extract `writeCountSummary` for the OBS-01 tables
- `ab5553d` refactor: extract `isEntrypoint` for the direct-invocation guards

## Must-have 1 - Atomic + bisect-safe (PASS)

Exactly 4 refactor commits, each a coherent single concern (`git show --stat`):

| Commit | Files | Serve()-reachable? | Bundle in commit? |
|--------|-------|--------------------|-------------------|
| `c0ec8b6` | `retention.ts`, `cleanup.ts` | no | no (correct) |
| `56ba4ad` | `releases-backend.ts`, `start-cache-server/index.js` | yes | YES |
| `1b50719` | `action/index.ts`, `cleanup/cleanup.ts`, `lib/summary.ts` | no | no (correct) |
| `ab5553d` | `esbuild.action.mjs`, `serve.ts`, `action/index.ts`, `cleanup/index.ts`, `roundtrip/read-back.ts`, `lib/is-entrypoint.ts`, `start-cache-server/index.js` | yes | YES |

Both serve()-reachable commits (`56ba4ad`, `ab5553d`) regenerate
`start-cache-server/index.js` in the SAME commit; the two non-serve()-reachable
commits correctly omit it (regen was a no-op). No stray file crossing concerns.

## Must-have 2 - Single-source achieved (PASS)

`git grep -n` across `packages/github-cache/src`:

- **`MS_PER_DAY`**: one definition, `retention.ts:27` (`export const`), imported by
  `cleanup.ts:3` and used at `cleanup.ts:68`. Duplicate local const removed.
- **`statusOf`**: `releases-backend.ts:95` get-catch now calls `warnOnce(statusOf(error))`.
  No inline `.status` duck-type remains in that catch. The only `status?: unknown`
  extraction in src is the single-source definition itself (`octokit-status.ts:17`);
  remaining `.status` hits are HTTP `response.status` / `put.status` / `get.status`
  (a distinct concern) and the test fault injector - not the octokit-error contract.
- **`writeCountSummary`**: defined once at `lib/summary.ts:13`, called by
  `action/index.ts:164` (runPublish) and `cleanup/cleanup.ts:132`. Each engine keeps
  its own fail-loud decision (cleanup `if (failed > 0) core.setFailed`; publish via
  top-level `run().catch(setFailed)`) - so semantics are preserved, only the table
  render is shared.
- **`isEntrypoint`**: defined once at `lib/is-entrypoint.ts:14`, called by all four
  bins - `serve.ts:175`, `action/index.ts:309`, `cleanup/index.ts:99`,
  `roundtrip/read-back.ts:67`. `pathToFileURL` now appears in src ONLY inside
  `is-entrypoint.ts` (import + doc + call), plus the `esbuild.action.mjs` comment and
  the `define` replacement string. The Windows Pitfall-6 rationale lives in the leaf.

## Must-have 3 - Bundle in sync at HEAD (PASS)

`npm run build:action` -> exit 0; `git diff --exit-code -- start-cache-server/index.js`
-> exit 0 (clean). The committed bundle matches a fresh regen at HEAD, so the
action-bundle-drift guard is satisfied.

## Must-have 4 - Green (PASS)

- `npx nx run-many -t typecheck test --skip-nx-cache` -> 27 test files, **344 tests
  passed**, typecheck clean. Exit 0.
- `npx nx run github-cache:integration --skip-nx-cache` -> **3 tests passed**. Exit 0.
- `npm run fallow:ci` (`fallow dead-code --fail-on-issues`) -> **0 issues**, 43 entry
  points detected. Exit 0.

## Must-have 5 - Behavior unchanged (PASS)

All four are pure single-source substitutions:

- `MS_PER_DAY` is the same `24 * 60 * 60 * 1000` value, relocated + exported.
- `statusOf(error)` returns `number | undefined`, exactly matching the replaced
  inline `typeof status === 'number' ? status : undefined`.
- `writeCountSummary` reproduces the byte-identical `addHeading(_, 2).addTable([...])`
  + `await core.summary.write()`; the distinct `setFailed` fail-loud lines are
  retained in each caller.
- `isEntrypoint(import.meta.url)` preserves the `!!process.argv[1] && url === pathToFileURL(...)`
  guard; esbuild's `define` still replaces `import.meta.url` so the bundled guard
  stays false. No control-flow or logic change beyond the substitutions.

## Verdict

**passed** - all four must-have truths hold against the codebase and git; the two
new leaves and the regenerated bundle are present; typecheck/test/integration/fallow
are all green; the changes are refactors only.
