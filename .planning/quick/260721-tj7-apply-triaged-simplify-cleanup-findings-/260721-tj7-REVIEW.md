# Code Review -- Quick task 260721-tj7

Scope: source changes of `git diff 8d3ff01..HEAD` on `gsd/v0.0.1-greenfield-rebuild`.
Four behavior-preserving cleanup refactors (single-source extraction / reuse).
Generated bundle `start-cache-server/index.js` excluded from review (inspected only
to verify the esbuild `define` still fires -- see finding 3).

Depth: quick. Focus: is behavior truly preserved?

## Verdict

**Clean bill.** All four refactors are behavior-equivalent (one is strictly safer).
No bugs, no security regressions, no leftover dead imports. Full package suite green
(27 files, 344 tests) after the change.

## Findings

None at any severity. Detail on each verification below.

### 1. `statusOf(error)` in releases-backend.ts -- equivalent, strictly safer

- Removed: `const status = (error as { status?: unknown }).status; warnOnce(typeof status === 'number' ? status : undefined)`.
- New: `warnOnce(statusOf(error))`.
- `statusOf` (lib/octokit-status.ts) returns `error.status` only when `error` is a
  non-null object whose `.status` is a `number`, else `undefined` -- identical result
  for every Octokit-shaped fault.
- It ADDS a `error !== null && typeof error === 'object'` guard the inline form
  lacked: the old `(error as {...}).status` would throw `TypeError` on a `throw null`
  / `throw undefined`. Net safer, not a behavior change for the realistic (object)
  path. Still status-only (never message/body) so the auth-diagnosability contract
  holds. No severity.

### 2. `writeCountSummary(heading, rows)` -- byte-identical summary at both sites

Helper builds `core.summary.addHeading(heading, 2).addTable([[{data:'metric',header:true},{data:'count',header:true}], ...rows.map(([m,c]) => [m, String(c)])])` then `await core.summary.write()`.

- Publish site (action/index.ts): heading `'github-cache publish'`, rows
  `mirrored/skipped/failed` in that order -- matches the removed inline table exactly
  (level-2 heading, both header cells, counts stringified via `String`).
- Cleanup site (cleanup/cleanup.ts): heading `'github-cache cleanup'`, rows
  `pruned/failed/scanned` -- matches its removed inline table exactly.
- Each engine KEEPS its own `if (failed > 0) core.setFailed(...)` fail-loud branch
  (distinct messages/thresholds) outside the helper -- correctly not folded in.
- Return type is now `Promise<void>` and both callers `await` it; the `await
  core.summary.write()` semantics are preserved. No severity.

### 3. `isEntrypoint(import.meta.url)` -- equivalent in all 4 sites; bundle guard stays false

- Removed idiom (serve.ts, action/index.ts, cleanup/index.ts, roundtrip/read-back.ts):
  `process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href`.
- Helper: `!!process.argv[1] && moduleUrl === pathToFileURL(process.argv[1]).href`.
  Only difference is the `!!` boolean coercion of `process.argv[1]`; truthiness is
  unchanged, so every guard evaluates identically.
- Bundle check (behavior-preservation, not a review of the generated file):
  `start-cache-server/index.js:68791` reads `if (isEntrypoint(__actionImportMetaUrl))`.
  esbuild's `define: { 'import.meta.url': '__actionImportMetaUrl' }` replaced the
  literal `import.meta.url` ARGUMENT at the serve.ts call site with the shim
  (`.../index.mjs`, never emitted); inside `isEntrypoint` it is compared against
  `pathToFileURL(process.argv[1]).href` (= `index.js`, the runner's `node index.js`).
  Shim != argv[1] -> guard false -> `main()` stays suppressed, no second server, no
  unmasked bearer token. Behavior identical to the pre-refactor inline guard. No severity.

### 4. No leftover unused imports

- `pathToFileURL` removed from serve.ts, action/index.ts, cleanup/index.ts,
  read-back.ts; `git grep` confirms zero remaining references in those files.
- `is-entrypoint.ts` is the single home for the `pathToFileURL(process.argv[1])`
  idiom (imports `node:url` correctly).
- cleanup/cleanup.ts drops its local `MS_PER_DAY` and imports it from retention.ts
  (used at line 68, `Date.now() - maxAgeDays * MS_PER_DAY`); `MS_PER_DAY` is now
  `export`ed from retention.ts. `core` still used (`core.setFailed`). No dead code.

## Evidence

- Static: read before/after of all 10 source files + `octokit-status.ts` and the
  esbuild config; `git grep` import-usage sweep.
- Runtime: `nx test github-cache` -> 27 files, 344 tests, all passing.
