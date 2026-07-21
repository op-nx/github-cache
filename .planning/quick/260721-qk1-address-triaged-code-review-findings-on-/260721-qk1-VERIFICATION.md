---
quick_id: 260721-qk1
status: passed
date: 2026-07-21
---

# Quick Task 260721-qk1 - Verification

Goal: address the triaged `/code-review max` findings on PR #3 as bisect-safe atomic
commits and keep CI green. Verified by re-running the full PR #3 check set locally on
the post-fix tree.

## must_haves

| Truth | Result |
|-------|--------|
| resolveMaxAgeDays never returns < 1 for a finite positive input (sub-1-day floors to 1) | PASS - new spec cases `'0.5'`/`'0.99' -> 1` green; node repro of the pre-fix `0.5 -> 0` confirmed the bug |
| The published github-cache bin launches on POSIX (dist/serve.js carries a shebang) | PASS - `head -1 dist/serve.js` == `#!/usr/bin/env node`; esbuild strips it from the action bundle (no drift) |
| nx.json test inputs include every repo-root file a test spec reads | PASS - `.github/workflows/cleanup.yml`, `.gitattributes`, `ppe/action.yml` added; dead storybook input removed; config parses; tests green |
| The weakened meta-guards fail when their invariant is actually violated | PASS - email-guard path fix was RED before correction (proving non-vacuity); conformance/docs guards now assert concrete artifacts/values |

## CI-parity battery (all green)

| Check | Result |
|-------|--------|
| `nx format:check --all` | exit 0 |
| `npm run fallow:ci` (`fallow dead-code --fail-on-issues`) | 0 issues |
| `npm run check:action` (action-bundle-drift) | exit 0, no drift |
| `nx run-many -t build` | success |
| `nx run-many -t typecheck` | success |
| `nx run-many -t test` | 341 passed |
| `npm run pack:check` | 79 files, no internals leaked |
| `nx run-many -t integration` | 3 passed (real loopback socket) |

Note: the push-only jobs (dogfood-seed/verify, consumer-smoke, publish,
publish-verify) do not run on `pull_request` and are not exercisable locally without
the Actions-cache runtime; they run post-merge on the default-branch push, as designed.

Verdict: passed.
