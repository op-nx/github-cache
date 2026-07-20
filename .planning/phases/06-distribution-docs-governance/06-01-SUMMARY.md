---
phase: 06-distribution-docs-governance
plan: 01
subsystem: infra
tags: [npm, esbuild, github-actions, js-action, packaging, distribution, mit-license]

# Dependency graph
requires:
  - phase: 01-server-foundation
    provides: serve() composition root + createCacheServer + the CacheBackend port types (the barrel + bin entry)
  - phase: 02-trust-and-backends
    provides: selectBackend(env) + the write-trusted Actions-cache backend that serve() composes
  - phase: 05-trust-widening-ppe-gate
    provides: the repo-root ppe/ action convention + selfcheck.cjs generate-and-byte-diff drift pattern
provides:
  - Publish-ready public npm package @op-nx/github-cache (not private, access:public, files:["dist"], bin, license MIT, public-gmail author, repository)
  - MIT LICENSE bundled into the package tarball (GOV-02)
  - uses:-consumable start-cache-server JS action with a committed, esbuild-bundled, drift-guarded index.js (never gitignored dist/)
  - Dependency-free npm-pack file-list guard (pack-check.cjs) proving dogfood-stays-local
  - esbuild 0.28.1 exact-pin + pinned-deps.spec.ts guard
  - CI wiring: action-bundle-drift + pack-check jobs + a push-gated consumer background-step live smoke
affects: [06-02, 06-03, 06-04]

# Tech tracking
tech-stack:
  added: [esbuild@0.28.1 (devDependency, action bundler)]
  patterns:
    - "Committed-bundle + CI drift guard (selfcheck.cjs pattern applied to the uses: action)"
    - "files:[\"dist\"] allow-list + npm pack --dry-run file-list assertion"
    - "import.meta.url shim so an ESM-import.meta dep (Azure crc64) bundles to CJS without crashing, while serve.ts's main()-guard stays false"

key-files:
  created:
    - packages/github-cache/LICENSE
    - packages/github-cache/README.md
    - packages/github-cache/pack-check.cjs
    - esbuild.action.mjs
    - start-cache-server/action.yml
    - start-cache-server/entry.ts
    - start-cache-server/index.js
  modified:
    - packages/github-cache/package.json
    - package.json
    - packages/github-cache/src/pinned-deps.spec.ts
    - .github/workflows/ci.yml
    - .prettierignore
    - .fallowrc.jsonc

key-decisions:
  - "build:action is a node script (esbuild.action.mjs), not an inline esbuild flag string: the required import.meta.url shim needs a computed banner that cannot be expressed cross-platform in an npm-script flag without fragile shell quoting (CLAUDE.md shell rule); mirrors the selfcheck.cjs generator-script convention."
  - "import.meta.url is shimmed to a sibling index.mjs URL in the bundle's own dir: valid for @actions/cache's Azure crc64 createRequire/fileURLToPath, but != pathToFileURL(argv[1]) so serve.ts's main() never runs in the bundle (no double-server, no unmasked token print)."
  - "@actions/core moved to ROOT dependencies (exact 3.0.1): the root workspace owns the action-bundle source (entry.ts), so it is a genuine build-time dependency there (fallow entry-reachability)."
  - "Consumer smoke follows the plan literally (exported NX_* vars) with a readiness poll + fail-loud diagnostic; the exportVariable-under-background behavior is the DOCS-06 first-push live close."

patterns-established:
  - "Pattern: a uses: JS action ships a COMMITTED esbuild bundle (deps inlined) at a non-gitignored path, kept honest by a `build + git diff --exit-code` CI job."
  - "Pattern: npm tarball governed by files:[\"dist\"] and asserted by a dependency-free node guard (pack-check.cjs), never .npmignore."

requirements-completed: [DOCS-06, GOV-02]

coverage:
  - id: D1
    description: "@op-nx/github-cache is publish-ready: not private, publishConfig.access=public, files:[\"dist\"], bin github-cache->./dist/serve.js, license MIT, public-gmail author, repository url."
    requirement: DOCS-06
    verification:
      - kind: other
        ref: "node -e package.json field assertions (private/access/files/bin/license/author/repository)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/pack-check.cjs (tarball ships package.json + dist/, excludes internals)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MIT LICENSE (holder Lars Gyrup Brink Nielsen) is bundled into the @op-nx/github-cache tarball."
    requirement: GOV-02
    verification:
      - kind: unit
        ref: "packages/github-cache/pack-check.cjs (asserts LICENSE present in npm pack --dry-run)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The committed start-cache-server/index.js esbuild bundle is in sync with entry.ts + inlined deps and loads without crashing."
    requirement: DOCS-06
    verification:
      - kind: unit
        ref: "npm run check:action (rebuild + git diff --exit-code, exit 0)"
        status: pass
      - kind: integration
        ref: "local node start-cache-server/index.js load+serve smoke (::add-mask:: before ::set-env::, server stays up, serve.ts main() does not run)"
        status: pass
    human_judgment: false
  - id: D4
    description: "esbuild is exact-pinned in the workspace devDependencies; a range would fail the build."
    requirement: DOCS-06
    verification:
      - kind: unit
        ref: "packages/github-cache/src/pinned-deps.spec.ts#esbuild is pinned to an exact version"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm-pack file-list guard proves the tarball ships dist/+LICENSE+README+package.json and excludes src/CI/dogfood internals (dogfood-stays-local)."
    requirement: DOCS-06
    verification:
      - kind: unit
        ref: "node packages/github-cache/pack-check.cjs (exit 0, 76 files, no leaks)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live consumer background-step round-trip: uses: ./start-cache-server (background:true) -> scripted PUT+GET over the exported NX_* vars through the write-trusted Actions-cache backend -> cancel: teardown."
    requirement: DOCS-06
    verification:
      - kind: integration
        ref: ".github/workflows/ci.yml consumer-smoke job (push-gated)"
        status: unknown
    human_judgment: true
    rationale: "The background-steps engine, core.exportVariable propagation to a later step, and the real Actions-cache round-trip are only observable on a default-branch push; this is the repo's established first-push live-close pattern (like dogfood/ppe)."

# Metrics
duration: 45min
completed: 2026-07-21
status: complete
---

# Phase 6 Plan 01: Distribution mechanics Summary

**@op-nx/github-cache flipped to a publish-ready public npm package (files:["dist"] + bin + MIT LICENSE), plus a new uses:-consumable start-cache-server JS action whose committed esbuild bundle is kept honest by a CI drift guard and a dependency-free npm-pack file-list guard.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-20T21:52Z (approx)
- **Completed:** 2026-07-20T22:37Z
- **Tasks:** 3
- **Files modified:** 13 (+ package-lock.json)

## Accomplishments
- Made the package publish-READY as public @op-nx/github-cache (removed private:true; added publishConfig.access=public, files:["dist"], bin, license MIT, public-gmail author, repository) and bundled the MIT LICENSE into the tarball (D-13, GOV-02).
- Shipped a NEW uses:-consumable JS action at repo-root start-cache-server/ (action.yml + entry.ts + a committed esbuild bundle index.js), SEPARATE from the internal dogfood action (D-09, Pitfall 1).
- Guarded the committed bundle with `npm run check:action` (esbuild rebuild + git diff --exit-code) and the tarball with a dependency-free pack-check.cjs (npm pack --dry-run file-list assertion) -- both wired as CI jobs.
- Exact-pinned esbuild 0.28.1 and extended pinned-deps.spec.ts so a range specifier fails the build (ROBUST-03).
- Wired a push-gated consumer background-step live smoke (uses: ./start-cache-server + background:true + a PUT/GET round-trip + a mandatory cancel: teardown) as the DOCS-06 first-push live proof.

## Task Commits

Each task was committed atomically:

1. **Task 1: publish-ready package + MIT LICENSE + esbuild pin** - `225dbe2` (feat)
2. **Task 2: consumer JS action + esbuild bundle + drift guard scripts** - `9f2632c` (feat)
3. **Task 3: CI drift guard + pack-check guard + background-step smoke** - `d61d1c5` (feat)

**Plan metadata:** (final docs commit — SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified
- `packages/github-cache/package.json` - Publish-ready fields (not private, access:public, files, bin, license, author, repository); exports untouched (Pitfall 8).
- `packages/github-cache/LICENSE` - MIT, holder "Lars Gyrup Brink Nielsen"; npm bundles it into the tarball (GOV-02).
- `packages/github-cache/README.md` - Concise npm-page consumer README (install + pointer to repo docs), not a root-README duplicate.
- `packages/github-cache/src/pinned-deps.spec.ts` - Added the esbuild exact-pin guard reading the root manifest (../../../package.json).
- `packages/github-cache/pack-check.cjs` - Dependency-free npm-pack file-list guard (allow dist/+LICENSE+README+package.json, forbid src/CI/dogfood internals).
- `esbuild.action.mjs` - Action bundler with the import.meta.url shim; produces the deterministic committed bundle.
- `start-cache-server/action.yml` - Consumer JS action (using node24, main index.js, input port).
- `start-cache-server/entry.ts` - Thin glue over serve(): getInput(port), serve(), setSecret(token), exportVariable the two NX_* client vars (A5).
- `start-cache-server/index.js` - Committed esbuild bundle (deps inlined; resolved from the git ref).
- `package.json` (root) - Scripts build:action/check:action/pack:check; esbuild devDep; @actions/core moved to dependencies.
- `.github/workflows/ci.yml` - action-bundle-drift, pack-check, and consumer-smoke jobs (existing jobs unchanged).
- `.prettierignore` - Ignore the generated bundle start-cache-server/index.js.
- `.fallowrc.jsonc` - Entries for entry.ts, esbuild.action.mjs, pack-check.cjs; ignore for the generated bundle.

## Decisions Made
- **build:action is a node script (esbuild.action.mjs), not an inline esbuild command.** The import.meta.url shim needs a computed banner; expressing it in a cross-platform npm-script flag would require fragile shell quoting (CLAUDE.md shell rule). A dedicated script mirrors the selfcheck.cjs convention and keeps the drift guard's git-diff deterministic.
- **import.meta.url shim -> a sibling index.mjs URL in the bundle dir.** Valid for @actions/cache's Azure crc64 createRequire/fileURLToPath, but deliberately != pathToFileURL(process.argv[1]).href, so serve.ts's direct-invocation main() guard stays false in the bundle (no second server, no unmasked bearer-token stdout print).
- **@actions/core moved to root `dependencies` (exact 3.0.1).** entry.ts (a root-workspace file) imports it, so it is a genuine build-time dependency of the root; keeps the fallow entry-reachability model honest without polluting ignoreDependencies.
- Bundler = esbuild (research OK verdict) over @vercel/ncc (SUS/too-new); no live-publish workflow this milestone (publish-READY only, D-13).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] esbuild CJS bundle crashed at load (import.meta.url = empty)**
- **Found during:** Task 2 (esbuild bundle)
- **Issue:** Research Assumption A3 ("a plain `esbuild --bundle --platform=node --format=cjs` produces a working entry") was falsified. @actions/cache transitively pulls @azure/storage-common's crc64 module, whose top-level `createRequire(import.meta.url)` / `fileURLToPath(import.meta.url)` runs at load; esbuild's CJS output makes `import.meta` empty, so the bundle threw `ERR_INVALID_ARG_VALUE: createRequire(undefined)` immediately on `node index.js` -- the action would fail in every consumer's CI.
- **Fix:** Replaced the inline esbuild command with esbuild.action.mjs that defines `import.meta.url` to a valid sibling-file URL in the bundle's own directory (via a banner using CJS __dirname). crc64's WASM is base64-embedded and require2 only resolves Node builtins, so a valid-but-non-matching URL makes it load; the non-matching URL also keeps serve.ts's main()-guard false. logOverride silences the now-benign empty-import-meta advisory.
- **Files modified:** esbuild.action.mjs (new), package.json (build:action -> node esbuild.action.mjs)
- **Verification:** `node start-cache-server/index.js` now stays up and emits ::add-mask:: then ::set-env:: for both NX_* vars; serve.ts's plaintext main() output is absent. `npm run check:action` exits 0 (byte-deterministic, no absolute paths embedded -> cross-OS drift-safe).
- **Committed in:** 9f2632c (Task 2)

**2. [Rule 3 - Blocking] @actions/core unlisted at the root manifest (fallow gate)**
- **Found during:** Task 2 (fallow:ci)
- **Issue:** entry.ts imports @actions/core, but the root package.json did not declare it; fallow flagged unlisted-dependency, then dev-in-production.
- **Fix:** Added @actions/core to root `dependencies` exact-pinned 3.0.1 (the root owns the action-bundle source).
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run fallow:ci` -> No issues found.
- **Committed in:** 9f2632c (Task 2)

**3. [Rule 3 - Blocking] New files broke the prettier + fallow gates**
- **Found during:** Task 2/3 (format:check --all, fallow:ci)
- **Issue:** The generated 2.4mb bundle is not prettier-formattable; entry.ts / esbuild.action.mjs / pack-check.cjs are never imported (fallow would flag them unused). Also the Task 1 packages/github-cache/package.json was flagged by prettier (repo prettier expands the single-element files array multi-line).
- **Fix:** .prettierignore ignores start-cache-server/index.js; .fallowrc.jsonc declares entry.ts / esbuild.action.mjs / pack-check.cjs as entries and ignores the generated bundle; ran prettier --write on packages/github-cache/package.json.
- **Files modified:** .prettierignore, .fallowrc.jsonc, packages/github-cache/package.json
- **Verification:** `npx nx format:check --all` clean; `npm run fallow:ci` clean.
- **Committed in:** 9f2632c (Task 2, format fix folded in), d61d1c5 (Task 3, pack-check.cjs entry)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking). All necessary for a working, gate-green distribution. No scope creep -- the deviations stayed within "make the committed bundle actually load and keep the existing gates green".
**Impact on plan:** The one form-change (build:action as a script rather than an inline command) is a faithful, more-robust implementation of the plan's intent; the acceptance criteria (bundle exists, check:action exits 0, deps inlined, serve not added to the barrel) are all met.

## Issues Encountered
- The consumer-smoke's use of the exported NX_* vars depends on core.exportVariable propagating from a `background:true` step to a later `run:` step -- an unverified behavior of the post-training-cutoff background-steps engine. Followed the plan literally (exported vars) with a readiness poll and a fail-loud `:?` diagnostic so a propagation gap surfaces as an actionable human_needed finding at verify-work rather than a silent green. This is the intended DOCS-06 first-push live close.

## Threat Surface
No new surface beyond the plan's threat register. T-06-01-01 (tarball leak) mitigated by files:["dist"] + pack-check.cjs; T-06-01-02 (esbuild) exact-pinned + guarded; T-06-01-03 (bundle tamper/stale) drift-guarded by check:action; T-06-01-04 (author/LICENSE identity) public gmail only, no work domain; T-06-01-05 (smoke permissions) workflow-default only. No threat flags.

## Known Stubs
None. entry.ts is fully wired to serve(); no placeholders, empty data sources, or TODO/FIXME markers introduced.

## User Setup Required
None - no external service configuration required. (An actual `npm publish` is deliberately deferred per D-13; the package is publish-READY only.)

## Next Phase Readiness
- The consumer action inputs (`port`) and the two exported NX_* vars are now the concrete surface that 06-02's DOCS-05 guard enumerates.
- 06-04 docs (quickstart) can reference `uses: op-nx/github-cache/start-cache-server@<ref>` with `background:`/`cancel:` and the npm `bin`/`&` fallback.
- One live item: the consumer-smoke green-on-push is a first-push human_needed close (verify-work), alongside the existing dogfood/ppe first-push closes.

## Self-Check: PASSED

All 7 created artifacts exist on disk (LICENSE, README.md, pack-check.cjs, esbuild.action.mjs, start-cache-server/{action.yml,entry.ts,index.js}) and all 3 task commits (225dbe2, 9f2632c, d61d1c5) are present. Full battery green: build, typecheck, 429 tests / 22 files, check:action, pack-check, format:check --all, fallow:ci.

---
*Phase: 06-distribution-docs-governance*
*Completed: 2026-07-21*
