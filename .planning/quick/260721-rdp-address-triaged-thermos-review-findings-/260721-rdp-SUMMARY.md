---
quick_id: 260721-rdp
title: Address triaged thermos review findings on PR #3
status: complete
branch: gsd/v0.0.1-greenfield-rebuild
date: 2026-07-21
commits:
  - 46324db fix(ppe): make advisory-hygiene installs non-fatal so they never fail a consumer job
  - 8ffbd05 test(github-cache): hoist the duplicated env-knob contract into one shared constant
  - 6b57ca8 docs(github-cache): correct the CacheBackend alias rationale
  - 8b1e1e4e docs(github-cache): note the PUT full-body buffering memory ceiling
---

# Quick Task 260721-rdp: Summary

Addressed the four findings that survived triage from the dual thermo-nuclear
review of PR #3. Four bisect-safe atomic commits on the current branch; no
worktree isolation (branch is 324 commits ahead of origin/main -- a worktree
would fork off origin/main and work against stale files). Executed inline.

## Findings fixed

- **[M1] fix(ppe)** -- the PPE composite action's advisory contract ("a finding
  never fails your job") was only enforced for findings, not the tool INSTALL
  steps. Under `bash -eo pipefail` a failed `pipx install zizmor` / actionlint
  download would propagate and fail the adopter's job. Installs now degrade to a
  `::warning::`; the zizmor audit no-ops when the binary is absent. Locked with
  three ppe-action.spec.ts assertions. (The zizmor install had to become a `run: |`
  block scalar -- the warning text's `PPE: ` colon-space is invalid in an inline
  YAML plain scalar; `format:check --all` caught it, the text-based spec did not.)
- **[Q5] test** -- hoisted the duplicated 7-element `EXPECTED_ENV_KNOBS` array out
  of public-surface.spec.ts + docs-adoption.spec.ts into a shared
  test/consumer-contract.ts so the two contract guards can't drift.
- **[Q3] docs** -- corrected the `CacheBackend` alias comment: it falsely claimed
  to be a "backward-compatible / historical public name" on a first release.
  Alias kept (documented public export); comment now honest.
- **[L3] docs** -- added a `ponytail:` note on handlePut's full-body in-memory
  buffering ceiling (N concurrent distinct-hash PUTs = up to N x 2 GiB) and its
  stream-to-temp upgrade path.

## Triaged but NOT actioned (deferred/rejected, with reasons)

- Q1/Q2 (strip private plan-ID comment taxonomy) -- DEFER: highest-churn possible,
  zero behavioral value, would wreck pre-merge diff reviewability. Own follow-up.
- Q4 (extract isEntrypoint helper) -- DEFER: marginal DRY across 4 entry files + bundle regen.
- Q6 (drop the `never` exhaustiveness guard) -- REJECT: it's compile-time insurance.
- Q7 (trim weak doc-topic-token guards) -- REJECT: they're passing tests.
- L2 (schedule-sync path unexercised e2e) -- DEFER: LOW; behavior change or fixture test.

## Verification (final HEAD, CI-equivalent)

- nx test github-cache: 344 passed (was 341; +3 M1 assertions)
- nx typecheck github-cache: pass
- nx format:check --all: pass
- npm run check:action (action-bundle-drift): pass -- bundle byte-identical (Q3/L3 are type/comment-only)
- npm run integration (real loopback socket round-trip): 3 passed
- npm run fallow:ci (dead-code): clean (the new test/ module is reachable)
- npm run pack:check: pass -- tarball ships dist/ + LICENSE + README + package.json only
- npm run build: pass

No email/domain leak (maintainer identity is the public gmail; governance-email guard green).
