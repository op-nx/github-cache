---
phase: 06-distribution-docs-governance
plan: 04
subsystem: docs
tags: [documentation, github-actions, nx, adoption, background-steps, markdown]

# Dependency graph
requires:
  - phase: 06-01
    provides: the start-cache-server consumer JS action (background-step sidecar) the docs teach
  - phase: 06-02
    provides: the DOCS-05 public-surface guard whose EXPECTED_ENV_KNOBS the config reference mirrors
  - phase: 06-05
    provides: docs/trust-and-security.md + docs/versioning.md that the README nav links to
provides:
  - Root README rewritten as the 5-minute default CI-RW quickstart + docs nav + pre-1.0 versioning note
  - docs/configuration.md - config reference for all 7 consumer env knobs + the 10 GB LRU and no-default-local-read notes; MAX_CACHE_BODY_BYTES documented as a fixed 2 GiB limit
  - docs/advanced.md - opt-in Releases reader / publish-sync / cleanup, the reader-only `&` fallback, and the JS-action-not-composite rationale
  - docs/examples/minimal-ci.yml + README - a minimal adopter workflow distinct from the dogfood ci.yml
  - docs-adoption.spec.ts - a content guard over the adoption docs, wired into nx.json test inputs
affects: [milestone-audit, verify-work, distribution, npm-publish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adoption docs render the settled surface (env knobs, action, trust model), never a re-typed guess; a content guard fails the build on drift"
    - "Repo-root docs read by an in-project spec are wired into nx.json test inputs (explicit paths) so a doc edit busts the Nx cache and re-runs the guard"

key-files:
  created:
    - docs/configuration.md
    - docs/advanced.md
    - docs/examples/minimal-ci.yml
    - docs/examples/README.md
    - packages/github-cache/src/docs-adoption.spec.ts
  modified:
    - README.md
    - nx.json

key-decisions:
  - "README quickstart passes GITHUB_TOKEN to the start-cache-server step (Rule 2): without a resolvable token selectBackend degrades to read-only and every write MISSes -- the quickstart would be silently broken otherwise"
  - "advanced.md documents publish/sync/cleanup by capability + trust/runtime requirements only; it does NOT present the internal packages/github-cache dogfood action as the consumer surface (prohibition), since the only shipped consumer entry points are the start-cache-server action and the serve bin"
  - "docs-adoption guard's repo-root docs wired into nx.json test inputs as explicit paths (not a glob), mirroring the 06-02/06-03 stale-cache fix"

patterns-established:
  - "Content-guard-over-docs: presence + required-topic tokens (not full prose) so ordinary edits do not churn the guard while a missing doc/knob/note fails the build"

requirements-completed: [DOCS-01, DOCS-02, DOCS-04, DOCS-06]

coverage:
  - id: D1
    description: "Root README is the 5-minute default CI-RW quickstart (start-cache-server background step + mandatory cancel: teardown) with docs nav and a pre-1.0 versioning note"
    requirement: DOCS-01
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-adoption.spec.ts#README references start-cache-server/background:/cancel:"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/configuration.md documents all 7 consumer env knobs + the 10 GB Actions-cache LRU note + the no-default-local-read note, and MAX_CACHE_BODY_BYTES as a fixed 2 GiB contract limit"
    requirement: DOCS-02
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-adoption.spec.ts#configuration.md documents the consumer contract"
        status: pass
    human_judgment: false
  - id: D3
    description: "docs/advanced.md covers opt-in Releases reader / publish-sync / cleanup, scopes the `&` fallback to the reader path only (CI-RW requires the JS action), and gives the JS-action-not-composite rationale"
    requirement: DOCS-06
    verification:
      - kind: other
        ref: "node token check: advanced.md contains reader / composite / ACTIONS_RUNTIME_TOKEN (Task 2 verify)"
        status: pass
    human_judgment: true
    rationale: "DOCS-06 faithfulness (that `&` is presented ONLY for the token-based Releases reader and NEVER as a CI-RW substitute) is a prose-correctness claim a human should confirm at verify-work; the token check proves presence, not that the scoping is stated correctly"
  - id: D4
    description: "docs/examples/minimal-ci.yml is a minimal adopter workflow (one job, default CI-RW only) distinct from this repo's maximal dogfood ci.yml"
    requirement: DOCS-04
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-adoption.spec.ts#minimal example is distinct from the dogfood config (no operation:/matrix:)"
        status: pass
    human_judgment: true
    rationale: "The plan's own verification flags a manual check that the example 'reads as smaller/simpler than ci.yml' -- the automated guard proves the absence of dogfood-only tokens, but the smaller/simpler judgment is a human read at verify-work"
  - id: D5
    description: "docs-adoption content guard fails the build on adoption-doc drift and is wired into nx.json test inputs so a repo-root doc edit re-runs it instead of replaying a stale pass"
    requirement: DOCS-06
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-adoption.spec.ts (23 tests) + nx test github-cache green (474 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-07-20
status: complete
---

# Phase 6 Plan 4: Split Adoption Docs Summary

**Rewrote the root README as a 5-minute default CI-RW quickstart and shipped the docs/ set (configuration reference, advanced guide, minimal adopter example) plus a docs-adoption content guard wired to fail on drift.**

## Performance

- **Duration:** 16 min (wall-clock; includes a usage-limit pause)
- **Started:** 2026-07-20T23:30:27Z
- **Completed:** 2026-07-20T23:46:27Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- Root README is now the consumer entry point: a copyable 5-minute quickstart using the `start-cache-server` background step with a mandatory `cancel:` teardown, `GITHUB_TOKEN` passed for the writable backend, plus docs nav and a one-line pre-1.0 versioning note. It states the internal dogfood action is not the consumer surface.
- `docs/configuration.md` documents every one of the 7 consumer env knobs (matching the DOCS-05 guard's EXPECTED_ENV_KNOBS) and their resolvers, presents `MAX_CACHE_BODY_BYTES` as a fixed 2 GiB contract limit, and includes the Actions-cache 10 GB per-repo LRU note and the no-anonymous-default-local-read note.
- `docs/advanced.md` covers the opt-in Releases reader (automatic via `selectBackend`), publish/sync and cleanup (by capability + trust/runtime requirements, not by exposing the dogfood action), the `&` fallback scoped strictly to the token-based Releases reader path (CI-RW writes require the JS action because a plain `run:`/`&` step has no `ACTIONS_RUNTIME_TOKEN`), and the JS-action-not-composite rationale.
- `docs/examples/minimal-ci.yml` + README: a minimal one-job adopter workflow, visibly smaller than and distinct from the maximal dogfood `ci.yml` (no `operation:`, no OS `matrix:`).
- `docs-adoption.spec.ts` (23 assertions) guards doc presence + required topics; its repo-root docs are wired into `nx.json` test inputs so drift re-runs the guard.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the root README as the 5-minute default quickstart + nav** - `9c80d3a` (docs)
2. **Task 2: Write docs/advanced.md + docs/configuration.md** - `d0c97cb` (docs)
3. **Task 3: Minimal example adopter config + docs-adoption content guard** - `afd4b1a` (docs)

**Plan metadata:** (final docs commit below)

## Files Created/Modified

- `README.md` - rewritten from the neutral `@op-nx/source` shell into the consumer quickstart + nav + versioning note.
- `docs/configuration.md` - consumer config reference (7 env knobs, resolvers, fixed body cap, 10 GB + no-local-read notes).
- `docs/advanced.md` - opt-in Releases reader / publish-sync / cleanup, reader-only `&` fallback, JS-action rationale.
- `docs/examples/minimal-ci.yml` - minimal copyable adopter workflow.
- `docs/examples/README.md` - explains the example and points to advanced.md / configuration.md.
- `packages/github-cache/src/docs-adoption.spec.ts` - adoption-docs content guard.
- `nx.json` - wired the 5 guard-read repo-root docs into `targetDefaults.test.inputs` (explicit paths).

## Decisions Made

- **GITHUB_TOKEN in the quickstart (Rule 2).** The README and minimal example pass `GITHUB_TOKEN` to the `start-cache-server` step. Without a resolvable token `selectBackend` hands back the read-only backend and every CI write is a silent MISS, so omitting it would ship a broken quickstart. Documented as a correctness requirement, not decoration.
- **Publish/sync/cleanup documented by capability, not by the dogfood action.** The only shipped consumer entry points are the `start-cache-server` action and the `github-cache` (`serve`) bin. Publish/cleanup exist as modules dogfooded by this repo's own CI. Per the plan prohibition, `advanced.md` describes what those layers do and their trust/runtime requirements without presenting `packages/github-cache/action.yml` as the consumer surface.
- **nx.json wiring as explicit paths, not a glob** (coordinator directive), mirroring the 06-02/06-03 stale-cache precedent.

## Deviations from Plan

None - plan executed exactly as written. (The nx.json test-input wiring is called out in the plan's critical constraints, not an unplanned deviation.)

## Issues Encountered

- **Prettier misparsed a wrapped line in advanced.md.** A prose line ending in `` `background: true` `` wrapped so the next line began `+ \`cancel:\``; Prettier read the leading `+ ` as a markdown list item and split the sentence into a stray list. Reworded to `` (`background: true` with a `cancel:` teardown) `` so no line starts with a list marker; re-ran Prettier to confirm the output is stable. No behavior impact (docs only).

## Out-of-scope discovery (logged, not fixed)

- The 06-05 `docs-trust.spec.ts` reads `docs/trust-and-security.md` + `docs/versioning.md` but they are NOT in `nx.json` test inputs -- the same stale-cache class 06-02/06-03 fixed. Out of scope for 06-04 (pre-existing, belongs to 06-05). Logged in `.planning/phases/06-distribution-docs-governance/deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- This is the last plan of Phase 6 (5/5). The adoption docs, config reference, minimal example, and the docs guard complete DOCS-01/02/04/06 alongside the earlier plans (DOCS-03/05, GOV-01/02/03).
- Ready for the post-execution gates: verify-work, secure-phase, validate-phase, then extract-learnings.
- `npx nx test github-cache` green (26 files / 474 tests); `npx nx format:check --all` clean.

## Self-Check: PASSED

- All created/modified files exist on disk (README.md, docs/configuration.md, docs/advanced.md, docs/examples/minimal-ci.yml, docs/examples/README.md, packages/github-cache/src/docs-adoption.spec.ts, nx.json).
- All task commits present: 9c80d3a, d0c97cb, afd4b1a.
- `npx nx test github-cache` green (26 files / 474 tests); `npx nx format:check --all` clean.

---
*Phase: 06-distribution-docs-governance*
*Completed: 2026-07-20*
