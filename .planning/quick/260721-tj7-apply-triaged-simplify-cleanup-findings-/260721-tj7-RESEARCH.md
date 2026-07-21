# RESEARCH -- 260721-tj7 apply 4 triaged /simplify cleanup findings

Read-only confirmation of the three load-bearing assumptions plus pitfalls. All
four fixes are reuse/altitude cleanups (no behavior change). Evidence is cited as
`file:line`.

## The 4 fixes (reachability recap)

| # | Edit | In serve() bundle graph? | Bundle regen? |
|---|------|--------------------------|---------------|
| 1 | `export MS_PER_DAY` from `retention.ts`; import into `cleanup.ts` (drop dup const) | retention.ts YES; cleanup.ts no | verify (likely no byte change) |
| 2 | `releases-backend.ts` get-catch uses `statusOf` instead of inline duck-type | YES (via selectBackend) | YES |
| 3 | extract `writeCountSummary` leaf (summary.ts); use in runPublish + cleanup | no (neither in serve graph) | no |
| 4 | extract `isEntrypoint` leaf; replace guard in serve.ts + 3 bins | serve.ts YES; 3 bins no | YES (serve.ts) |

`selectBackend` imports `createReleasesReadBackend/createReleasesReadClient`
(`select-backend.ts:3-6`) and `serve()` calls `selectBackend(process.env)`
(`serve.ts:89`), so `releases-backend.ts` (Fix 2) and `retention.ts` (Fix 1, via
`releases-backend.ts:6`) are both in the serve import graph. The four bins
(`action/index.ts`, `cleanup/index.ts`, `roundtrip/read-back.ts`) and `summary.ts`
are NOT -- they sit above/beside serve, so editing them never drifts
`start-cache-server/index.js`.

## A. esbuild bundle contract -- CONFIRMED

- esbuild config: `define: { 'import.meta.url': '__actionImportMetaUrl' }` +
  `banner` defining `__actionImportMetaUrl` = `pathToFileURL(join(__dirname,"index.mjs")).href`
  (`esbuild.action.mjs:35-36`). `define` is a whole-bundle AST substitution: it
  replaces EVERY `import.meta.url` token in the graph, including one passed as a
  call argument.
- Rewriting `serve.ts:176-179` to `isEntrypoint(import.meta.url)` keeps the
  `import.meta.url` token AT the serve.ts call site, so `define` still rewrites it
  to `isEntrypoint(__actionImportMetaUrl)`. Inside the new leaf, the guard is
  `moduleUrl === pathToFileURL(process.argv[1]).href`; runner invokes `node index.js`
  so argv[1].href (index.js) != __actionImportMetaUrl (index.mjs) -> guard FALSE in
  the bundle, exactly as today. main()/server-spawn stays suppressed. Behavior
  preserved. The new `is-entrypoint.ts` contains NO `import.meta`, so it adds no new
  substitution site.
- Bundle regen IS required for Fix 4 (serve.ts) and Fix 2 (releases-backend.ts +
  pulls octokit-status.ts into the graph). `check:action` = `npm run build:action
  && git diff --exit-code -- start-cache-server/index.js` (`package.json:15`); the
  `action-bundle-drift` job fails if the committed bundle drifts. Run
  `npm run build:action` and commit `start-cache-server/index.js` in the SAME commit.
  For Fix 1 (retention.ts `export` keyword -- stripped when bundled; MS_PER_DAY
  still internally used at `retention.ts:86`) and Fix 3, a byte change is unlikely,
  but the build+diff is the authority -- run it and commit only if it changed.

## B. Intra-module ESM mock pitfall (why finding #5 was SKIPPED) -- CONFIRMED (skip is correct)

- Today `runPublish` lives in `action/index.ts` and calls `resolveGitHubToken`
  imported from `../lib/github-identity.js` (`action/index.ts:8,144`). The spec
  partial-mocks that module: `{ ...actual, resolveGitHubToken: vi.fn() }`
  (`action/index.spec.ts:35-39`) and drives the "no token -> throw" test via
  `resolveGitHubTokenMock.mockReturnValue(undefined)` (`index.spec.ts:84-86`). It
  works BECAUSE the caller is a DIFFERENT module importing the mocked export.
- If token resolution moved into a NEW `resolveWriteIdentity()` INSIDE
  `github-identity.ts` that internally calls `resolveGitHubToken`, that call is a
  lexical (module-local) reference to the module's own function declaration -- it
  does NOT go through the module's export namespace. Vitest's `vi.mock` factory only
  replaces what OTHER modules import; it cannot rebind an intra-module local call.
  Worse, the factory spreads `...actual`, so `resolveWriteIdentity` would be the REAL
  one calling the REAL `resolveGitHubToken`, and `resolveGitHubTokenMock` would no
  longer control the token path -> the "no token -> throw" test loses its lever.
- Verdict: the skip reasoning is sound. (Standard escape hatches -- call via
  `import * as self` namespace, or keep the split across modules -- exist but are out
  of scope; #5 stays skipped.)

## C. Spec safety of the applied fixes -- CONFIRMED

- OBS-01 (`cleanup.spec.ts:211-230`): asserts `core.summary.addTable` called once,
  reads `mock.calls[0][0]`, JSON-includes `pruned`/`failed`/`scanned`, and
  `write` called once. A `writeCountSummary(heading, rows)` leaf that does
  `core.summary.addHeading(heading, 2).addTable(table); await core.summary.write();`
  reproduces this verbatim -- provided it calls `addTable` exactly once and emits the
  same header row + `[label, String(count)]` rows. Both current call sites are
  BYTE-IDENTICAL in header shape (`{data:'metric'|'count',header:true}`) and heading
  level 2 (`cleanup.ts:131-140`, `action/index.ts:163-172`), so one leaf covers both.
- No `runPublish` success/summary test exists -- the three runPublish specs
  (`index.spec.ts:58-89`) all return/throw at the gate/fail-closed/no-token branches
  BEFORE the summary, so Fix 3 has no publish-side assertion to satisfy.
- No spec mocks `../lib/retention.js` (grep: zero hits), so exporting `MS_PER_DAY`
  and importing it into `cleanup.ts` cannot be stripped by a module mock. `MS_PER_DAY`
  currently lives in both files identically (`retention.ts:26`, `cleanup.ts:5`).
- No spec pins the entrypoint-guard expression (only a prose comment mention,
  `index.spec.ts:13`) and no spec asserts on `pathToFileURL`. The error-string
  assertions (`/no GH_TOKEN\/GITHUB_TOKEN/`, `/owner\/name/`, `index.spec.ts:77,86`)
  belong to runPublish, which fixes 1-4 do not touch.

## Pitfalls

1. **Unused `pathToFileURL` import after Fix 4.** Each of `serve.ts:4`,
   `action/index.ts:1`, `cleanup/index.ts:1`, `roundtrip/read-back.ts:1` imports
   `pathToFileURL` from `node:url` SOLELY for the guard. After swapping to
   `isEntrypoint(import.meta.url)`, remove each import or TS `noUnusedLocals`/lint
   fails. `is-entrypoint.ts` becomes the one owner of that import.
2. **Regenerate the bundle in the SAME commit** for Fix 2 + Fix 4 (serve graph):
   `npm run build:action`, then stage `start-cache-server/index.js`. Skipping this
   fails the `action-bundle-drift` CI job. (See memory: action-bundle-inlines-serve-deps.)
3. **fallow dead-code on the new exports.** `MS_PER_DAY`, `writeCountSummary`,
   `isEntrypoint` each have >=1 in-graph importer, so they are reachable (not dead) --
   but run `npm run fallow` to confirm; a leaf with a typo'd/missing importer would
   trip it.
4. **Windows `git commit -m` on Dev Drive (ReFS D:) fails with COMMIT_EDITMSG
   "Invalid argument".** Use `git commit -F <file>`. (See memory: git-commit-editmsg-einval.)
5. **Stage files by name, never `git add -A/.`** -- the bundle regen + source edits
   must be staged explicitly.
6. **Preserve the two summary call sites' identical shape** when extracting
   `writeCountSummary` -- keep `addHeading(heading, 2)`, one `addTable`, one `write`,
   and the `metric`/`count` header, or OBS-01 (`cleanup.spec.ts:222`) breaks.

## RESEARCH COMPLETE

File: `D:\projects\github\op-nx\github-cache\.planning\quick\260721-tj7-apply-triaged-simplify-cleanup-findings-\260721-tj7-RESEARCH.md`
