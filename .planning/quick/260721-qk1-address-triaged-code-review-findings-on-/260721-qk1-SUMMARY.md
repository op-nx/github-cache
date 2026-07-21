---
quick_id: 260721-qk1
description: Address triaged code-review findings on PR #3
status: complete
date: 2026-07-21
branch: gsd/v0.0.1-greenfield-rebuild
commits:
  - 2ff9d78 fix(retention) clamp sub-1-day CACHE_MIRROR_MAX_AGE_DAYS to a 1-day floor
  - 0291e6f fix(package) node shebang so the github-cache bin runs on POSIX
  - 8514997 fix(nx) wire spec-read repo-root files into test inputs; drop dead storybook input
  - dd71737 test: make three weak meta-guards actually bite
---

# Quick Task 260721-qk1 - Summary

Third round of PR #3 (v0.0.1) code-review remediation. A built-in `/code-review max`
run fanned out six finders over the origin/main...HEAD diff (excluding `.planning/`),
adversarially verified each candidate, and reported 16 findings (1 high, 4 medium,
11 low). After triage, four were fixed as bisect-safe atomic commits; the rest were
dismissed as by-design / benign / documented, or one proved un-fixable-as-proposed.

## Fixed (4 atomic commits, each green on its own)

1. **`2ff9d78` fix(retention) - HIGH.** `resolveMaxAgeDays` returned 0 for any
   `CACHE_MIRROR_MAX_AGE_DAYS` in (0,1) (`Math.floor(0.5)=0` passed the `raw<=0`
   guard), which set cleanup's `cutoff = now` and pruned the entire in-window mirror
   - a direct violation of the one non-negotiable retention-locked rule. Clamped to
   `Math.max(1, ...)`; pinned `'0.5'`/`'0.99' -> 1`. Regenerated the esbuild action
   bundle in the same commit (it inlines `resolveMaxAgeDays` via `serve()`), so
   `action-bundle-drift` stays green on this commit.

2. **`0291e6f` fix(package) - medium.** `bin.github-cache -> dist/serve.js` had no
   shebang, so the documented `npx @op-nx/github-cache` CLI failed with ENOEXEC on
   POSIX (worked on Windows via the cmd-shim, hiding it). Added `#!/usr/bin/env node`
   to `serve.ts`; tsc preserves it into `dist/serve.js`. esbuild strips it when
   bundling into `start-cache-server/index.js`, so the action bundle is unchanged
   (verified via `check:action`).

3. **`8514997` fix(nx) - medium + low.** Three workspace-root files read by test
   specs (`.github/workflows/cleanup.yml`, `.gitattributes`, `ppe/action.yml`) were
   not in `targetDefaults.test.inputs`, so editing them replayed a cached PASS (the
   invariant `docs-adoption.spec.ts` states). Added them; also removed the dead
   `{projectRoot}/tsconfig.storybook.json` fileset (no Storybook here).

4. **`dd71737` test - three low-severity meta-guards.** Made a tautological Nx-version
   assertion bite (tie the vendored spec filename to `PINNED_NX_VERSION`); replaced a
   silent early-return in the email-hygiene guard with an existence assertion - which
   **uncovered a real coverage hole**: the "this package's package.json" scan path
   `../../package.json` resolved to the nonexistent `packages/package.json`, so the
   maintainer manifest was never actually scanned (fixed to `../package.json`); and
   anchored the disclosure-window check to the concrete 7-day/90-day windows.

## Not fixed (triaged, with rationale)

- **select-backend token gate (medium)** - the writable backend is gated on a token
  `@actions/cache` never uses (it authenticates via `ACTIONS_RUNTIME_TOKEN`). Real
  footgun, but the degrade-to-read-only-on-no-token behavior is deliberate and
  spec-pinned (TEST-01); changing it alters a tested contract. Surfaced as a design
  note for the maintainer.
- **hash-lock get/put temp-file race + `-1` probe race (low)** - benign
  (content-addressed; Nx tolerates a spurious PUT 500) and only reachable outside the
  documented single-tenant deployment. NB: the tempting "unique temp path" fix would
  break `@actions/cache` version-hashing.
- **read-back integrity gap (low)** - defense-in-depth; a content-hash check is a
  feature (YAGNI).
- **omitted-port ephemeral fallback / prepack hook / ppe `curl|bash` (low)** -
  documented / already mitigated (immutable SHA pin).
- **public-surface `\bKNOB\b` weak guard (low)** - NOT fixed: scoping it to a read
  site would break `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`, a consumer-set knob our code
  never reads via env. A correct per-knob classification isn't worth the churn.

## Verification (full local CI battery, matching PR #3 checks)

All green on the merged tree after the four commits:
`format:check --all`, `fallow:ci` (0 issues), `check:action` (no bundle drift),
`build`, `typecheck`, `test` (341 passed), `pack:check` (79 files, no internals
leaked), `integration` (3 passed, real loopback socket).

must_haves: all satisfied - retention never returns <1 for finite positive input
(new spec cases green); the bin carries a shebang in dist; the three repo-root files
are declared test inputs; the four weakened guards now fail if their invariant breaks
(the email-guard path fix proven by the RED it produced before the path correction).
