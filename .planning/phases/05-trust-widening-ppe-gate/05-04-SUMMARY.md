---
phase: 05-trust-widening-ppe-gate
plan: 04
subsystem: infra
tags: [github-actions, zizmor, actionlint, composite-action, ppe, security, ci]

# Dependency graph
requires:
  - phase: 05-03
    provides: selfcheck CI job (the ci.yml check-battery slot the PPE job wires in after)
  - phase: 04
    provides: config-assertion test pattern (cleanup-workflow.spec.ts) + live-CI first-push proof precedent
provides:
  - "ppe/action.yml: installable ADVISORY PPE-hygiene composite action self-installing exact-pinned zizmor==1.27.0 + actionlint 1.7.12"
  - "ppe-action.spec.ts: mutation-proven config-assertion for composite form, both pins, advisory posture"
  - "ppe/fixtures/unsafe-workflow.yml: known-unsafe scan target (pull_request_target + PR-head checkout + untrusted event field in run:)"
  - "ci.yml advisory `ppe` dogfood job: uses ./ppe against the fixture (non-blocking, first-push live close)"
affects: [phase-6-docs, adopter-onboarding, trust-model-docs]

# Tech tracking
tech-stack:
  added: [zizmor 1.27.0 (self-installed via pipx), actionlint 1.7.12 (self-installed via download-actionlint.bash)]
  patterns: [composite-action self-installing exact-pinned CLI tools, advisory (--no-exit-codes / swallowed-exit) security gate, config-assertion spec for a shipped action.yml]

key-files:
  created:
    - ppe/action.yml
    - ppe/fixtures/unsafe-workflow.yml
    - packages/github-cache/src/ppe/ppe-action.spec.ts
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "PPE gate ships as a composite action at top-level ppe/ so adopters consume op-nx/github-cache/ppe@vX (D-10)"
  - "Both tools EXACT-pinned and self-installed by the action; consumer never provides them (D-11); guarded by a config-assertion spec since pinned-deps.spec.ts cannot see consumer-runtime installs"
  - "Advisory posture: zizmor --no-exit-codes + actionlint exit swallowed; positioned in name/description as NOT the containment control (D-12)"
  - "This repo's own CI runs the PPE gate advisory (annotations only), resolving RESEARCH open question 2"
  - "zizmor invoked without --persona (default regular covers the named patterns) and without --offline, matching the plan's exact command; advisory --no-exit-codes makes a missing GH_TOKEN a warning, not a failure"

patterns-established:
  - "Composite action self-installing exact-pinned external CLIs, each run step declaring shell: bash, no top-level env"
  - "Advisory security dogfood: run a shipped action against a deliberately-unsafe fixture kept outside .github/workflows so it never executes"
  - "Config-assertion spec (comment-stripped, mutation-proven) as the D-11 exact-pin analog for tools npm cannot guard"

requirements-completed: [TRUST-06]

coverage:
  - id: D1
    description: "Composite PPE-hygiene action structure: using: composite, exact pins zizmor==1.27.0 + actionlint 1.7.12, --no-exit-codes advisory posture, per-step shell + no top-level env"
    requirement: "TRUST-06"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/ppe/ppe-action.spec.ts#ppe/action.yml composite PPE-hygiene gate (TRUST-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Advisory PPE action actually runs zizmor/actionlint on the unsafe fixture and emits findings while passing the job (advisory)"
    requirement: "TRUST-06"
    verification:
      - kind: manual_procedural
        ref: "ci.yml `ppe` job on first default-branch push -- confirm zizmor/actionlint findings emitted and job non-failing"
        status: unknown
    human_judgment: true
    rationale: "Needs a real GitHub-hosted runner to self-install the tools and scan the fixture; the live findings-produced behavior is a first-push close (like the Phase 4 mirror round-trip), not reproducible in local Vitest"

# Metrics
duration: 6min
completed: 2026-07-20
status: complete
---

# Phase 5 Plan 04: Installable PPE-Hygiene Gate (Composite Action) Summary

**Adopter-facing ADVISORY PPE-hygiene composite action (ppe/action.yml) self-installing exact-pinned zizmor 1.27.0 + actionlint 1.7.12, mutation-proven by a config-assertion spec, and dogfooded advisory against an unsafe fixture in CI (TRUST-06)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-20T10:11:35Z
- **Completed:** 2026-07-20T10:17:52Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 edited)

## Accomplishments
- Shipped `ppe/action.yml`, an installable COMPOSITE action (`runs.using: composite`) that self-installs exact-pinned `zizmor==1.27.0` (pipx) and `actionlint 1.7.12` (official `download-actionlint.bash`) and runs both ADVISORY (zizmor `--no-exit-codes`, actionlint exit swallowed) for the named unsafe-trigger patterns. Consumer supplies runs-on + actions/checkout; the action never fails their job by default.
- Positioned the gate as best-effort/advisory defense-in-depth in name + description, explicitly NOT the containment control (containment stays TRUST-02 sync gate + default-branch protection, D-12 / ADR C4).
- Added `ppe-action.spec.ts`, a comment-stripped, mutation-proven config-assertion that locks the composite form, both exact pins, the `--no-exit-codes` advisory switch, the advisory/not-containment marker, and per-step `shell:` + no top-level `env:`.
- Added `ppe/fixtures/unsafe-workflow.yml` (deliberately unsafe: `pull_request_target` + PR-head checkout + untrusted `${{ github.event.pull_request.title }}` in a `run:` step) as a scan target, kept OUTSIDE `.github/workflows` so GitHub never executes it.
- Wired an advisory `ppe` dogfood job into `ci.yml` invoking `uses: ./ppe` against the fixture (non-blocking); its findings-produced behavior is the first-push live close for TRUST-06.

## Task Commits

Each task was committed atomically:

1. **Task 1: Composite PPE action + config-assertion spec** - `b63a981` (feat)
2. **Task 2: Unsafe fixture + advisory PPE CI job** - `ab76c2a` (feat)

**Plan metadata:** (final docs commit) - see git log

## Files Created/Modified
- `ppe/action.yml` - Composite PPE-hygiene action: self-installs exact-pinned zizmor + actionlint, runs them advisory, positioned as advisory-not-containment; every run step sets `shell: bash`, no top-level `env:`; optional `path` input (default `.`).
- `packages/github-cache/src/ppe/ppe-action.spec.ts` - Config-assertion (reads `../../../../ppe/action.yml` via `import.meta.url`, strips `#` lines): asserts composite form, `zizmor==1.27.0`, actionlint `1.7.12`, `--no-exit-codes`, advisory/not-containment marker, per-step shell + no top-level env. Mutation-proven (pin change fails).
- `ppe/fixtures/unsafe-workflow.yml` - Intentionally-unsafe fixture workflow (scan target only, never under `.github/workflows`).
- `.github/workflows/ci.yml` - Added the advisory `ppe` dogfood job (after `selfcheck`) running `./ppe` against the fixture.

## Decisions Made
- **Composite action at top-level `ppe/`** (D-10, RESEARCH open question 1 RESOLVED): adopters consume `op-nx/github-cache/ppe@vX` cleanly rather than a deep package path.
- **Exact pins self-installed, guarded by a config-assertion spec** (D-11): the tools are consumer-runtime installs, invisible to `pinned-deps.spec.ts`, so `ppe-action.spec.ts` is the D-11 exact-pin analog.
- **Advisory posture for this repo's own CI** (D-12, RESEARCH open question 2 RESOLVED): annotations only, `--no-exit-codes`; dogfooding it at all satisfies "shipped installable".
- **zizmor command kept minimal** (`zizmor "<path>" --no-exit-codes`, default regular persona, no `--offline`): matches the plan's exact command and the spec's assertion surface; a missing GH_TOKEN degrades to a warning under `--no-exit-codes`, never a job failure.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The config-assertion's "not-containment" regex initially failed because the folded YAML description broke "not ... containment" across a source line and the `#`-header lines carrying the phrase were comment-stripped. Fixed by rewording the description so "not the containment control" sits on one source line and making the regex whitespace-tolerant. Resolved within Task 1 before commit.
- The first mutation-proof run reported a false pass because Nx cached the `test` target (ppe/action.yml is read at runtime via `readFileSync` and is not a declared Nx input, so mutating it did not invalidate the cache). Re-ran with `--skip-nx-cache` to confirm the pin mutation genuinely fails the spec. This is an inherent property of the config-assertion pattern (shared with `cleanup-workflow.spec.ts`); CI runs from a clean checkout so the committed action.yml is always what the spec asserts against.

## Known Stubs
None - the action, fixture, spec, and CI job are all fully wired. No placeholder data or dead components.

## Live / First-Push Verification (human_needed)
The advisory `ppe` CI job's "actually emits findings" behavior (coverage D2) closes on the first default-branch push, like the Phase 4 mirror round-trip. Expected on that run: the action self-installs zizmor + actionlint, scans `ppe/fixtures/unsafe-workflow.yml`, emits dangerous-triggers / template-injection / unpinned-uses findings as annotations, and the job PASSES (advisory). Confirm this on the CI run to close TRUST-06's live leg.

## User Setup Required
None - no external service configuration required. The composite action self-installs its tools at runtime on the consumer's runner.

## Next Phase Readiness
- TRUST-06 delivered: the installable advisory PPE-hygiene gate is shipped, structurally locked, and dogfooded. Phase 6 (DOCS-03) documents the trust model and can reference `op-nx/github-cache/ppe@vX` as the adopter-facing advisory gate.
- Blocker/None: the only open item is the first-push live confirmation of findings (advisory job), which is a CI-run observation, not a code gap.

## Self-Check: PASSED

- All created files present on disk: `ppe/action.yml`, `ppe/fixtures/unsafe-workflow.yml`, `packages/github-cache/src/ppe/ppe-action.spec.ts`, `05-04-SUMMARY.md`.
- Both task commits present in history: `b63a981`, `ab76c2a`.
- Phase-gate battery green: `npx nx test github-cache`, full `npm run test`, `npm run typecheck`, `npm run build`, `node packages/github-cache/selfcheck.cjs` (exit 0), `npm run fallow:ci` (0 issues), `npx nx format:check --all` (exit 0).

---
*Phase: 05-trust-widening-ppe-gate*
*Completed: 2026-07-20*
