---
phase: 12
slug: windows-ci-reuse-o4-consumer-recipe
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 12 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `12-RESEARCH.md` `## Validation Architecture`. Task IDs are filled in after
> planning; the requirement-level map below is authoritative until then.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest via `@nx/vitest` (inferred `test` target, `testTargetName: "test"`) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit); `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npx nx run @op-nx/github-cache:test --skip-nx-cache` |
| **Full suite command** | `npm run test` (`nx run-many -t test`) |
| **Estimated runtime** | ~4 seconds (measured 3.8 s cold, 2026-07-30, win32/arm64) |
| **Current baseline** | 40 test files / 856 tests, all passing on win32/arm64 |

---

## Sampling Rate

- **After every task commit:** Run `npx nx run @op-nx/github-cache:test`
- **After every plan wave:** Run `npm run test && npm run typecheck && npm run lint && npx nx format:check --all`
- **Before `/gsd:verify-work`:** Full suite must be green, plus `npm run check:action` from the MAIN
  working tree -- never from a junctioned worktree, where esbuild rewrites 689 module paths and
  produces a false drift verdict with no source edit.
- **Max feedback latency:** 5 seconds

---

## The honest constraint, stated before the map

Three of this phase's four requirements are **not Vitest-testable by construction**:

- **XOS-05's HIT** is a property of the GitHub Actions cache service observed in a runner log. No
  spec can produce it. REQUIREMENTS.md and ROADMAP both say so (`Live-CI close`).
- **XOS-04 / XOS-08's EFFECT** (that the Windows leg actually reuses the ubuntu artifact) is the
  same observation.
- **DOCS-07's QUALITY** (is the recipe correct and safe?) is a review judgement, not an assertion.

What IS mechanically testable is the **shape** of each: that the jobs exist with the right
`runs-on` / `needs:`, that the doc exists and renders the single-sourced literal, that the
discriminator is registered exactly once, and that the doc is an `nx.json` `test` input so the guard
cannot replay a stale pass.

Proposing specs for the unobservable half would manufacture false coverage -- the exact defect
`08-ROOT-CAUSE.md:2056` names ("a textual assertion that `nx.json` CONTAINS the discriminator does
NOT satisfy CORR-03").

---

## Per-Requirement Verification Map

Task IDs are assigned at planning time; this map binds each requirement to its verification shape
now so the planner cannot silently drop one.

| Req | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-----------|-------------------|-------------|--------|
| XOS-04 | `ci.yml` declares `build-windows` / `typecheck-windows` / `test-windows`, each `runs-on: windows-11-arm` | -- | unit (YAML shape) | `npx nx run @op-nx/github-cache:test -- -t "windows"` | W0 -- extend `dogfood-cross-os.spec.ts` | pending |
| XOS-08 | each Windows job declares `needs:` on exactly its one ubuntu counterpart | -- | unit (YAML shape) | same spec | W0 | pending |
| XOS-08 | sidecar block byte-identical across all seven wired jobs | -- | unit (optional) | -- | **DEFERRED by CONTEXT** -- the block drift guard is an explicit Deferred Idea. Do NOT add it | n/a |
| XOS-05 | the Windows legs log `[remote cache]` for all three targets | -- | **live-CI only** | none -- read the run log, count OCCURRENCES (`rg -o \| wc -l`) against D-19's pre-registered numbers | n/a | pending |
| XOS-05 | the write decision + attribution loss recorded alongside TRUST-11/12 | T-12 (see `12-RESEARCH.md` `## Security Domain`) | doc artifact | none -- a `.planning/**` edit, not an Nx input, correctly ungated | n/a | pending |
| XOS-05 | detector workflow exists, is `windows-11-arm`, uses `--skip-nx-cache`, demands the success LINE | -- | unit (YAML shape) | `npx nx run @op-nx/github-cache:test -- -t "detector"` | W0 -- `cleanup-workflow.spec.ts` shape | pending |
| XOS-05 | the detector actually goes green on a `windows-11-arm` runner | -- | **live-CI, POST-MERGE** | `workflow_dispatch` once the file reaches `main` | n/a | pending |
| DOCS-07 | `docs/cross-os.md` exists and is an `nx.json` `test` input | -- | unit | `npx nx run @op-nx/github-cache:test -- -t "cross-os"` | W0 | pending |
| DOCS-07 | safe default FIRST, portability checklist SECOND | -- | unit (ordered index assertion, phrase-keyed) | same | W0 | pending |
| DOCS-07 | the doc names architecture AND libc, and states this repo cannot exercise either | -- | unit (phrase-keyed, COUNT-asserted) | same | W0 | pending |
| DOCS-07 | the doc renders the exact discriminator literal `nx.json` declares | -- | unit (single-sourced equality, `docs-trust.spec.ts` shape) | same | W0 | pending |
| DOCS-07 | `nx.json` declares exactly ONE runtime input and it is the new literal | -- | unit | `npx nx run @op-nx/github-cache:test -- -t "discriminator"` | **EXISTS** -- `nx-target-inputs.spec.ts:400` and `:446`; update both literals | pending |
| DOCS-07 (U-01) | the new command's raw stdout AND stderr, per OS, on real runners | -- | **live-CI, but FREE** | already wired -- `capture-hashes.mjs` reads the command out of `nx.json` and records both streams into `hash-parity-<os>.json` on both legs | **EXISTS** -- no new instrument needed | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `ci.yml` Windows-job shape assertions -- extend
      `packages/github-cache/src/dogfood-cross-os.spec.ts` (already asserts on `ci.yml`, and
      `ci.yml` is already a `test` input at `nx.json:69`).
- [ ] Detector-workflow shape assertions -- new describe block, `cleanup-workflow.spec.ts` shape.
- [ ] **`nx.json` `test` input registration for the new detector workflow file** -- SAME COMMIT as
      the spec (CONTEXT D-09). Without it the spec replays a stale cached PASS; that is PARITY-08's
      whole lesson.
- [ ] **`nx.json` `test` input registration for `docs/cross-os.md`** -- SAME COMMIT as the doc.
- [ ] `docs/cross-os.md` drift guard -- new spec file or a `docs-adoption.spec.ts` extension
      (Claude's discretion per CONTEXT).
- [ ] Update the two discriminator literals in `nx-target-inputs.spec.ts` (`:400`, `:446`) and the
      fixture in `hash-parity/compare.spec.ts:99`.
- [ ] Framework install: **none needed.**

**Every new guard must be OBSERVED RED before it is trusted** -- mutate the thing it asserts on,
confirm the named assertion fails with the right cause, revert. Two standing traps from Phase 11:
a phrase occurring TWICE is only half-locked (`toContain` stops at the first occurrence -- assert a
COUNT or key on a phrase measured unique), and a predicted-only redness is not evidence.
Accelerant: `08-ROOT-CAUSE.md:2148` already records mutation M3 for the discriminator pin.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The three Windows legs log `[remote cache]` against ubuntu-saved entries | XOS-05 | A property of the GitHub Actions cache service across two jobs; no in-process spec can observe it | Open the FIRST run of the proving PR (never a re-run -- see CONTEXT D-18 correction). Per target, count `[remote cache]` OCCURRENCES in the Windows leg's log with `rg -o \| wc -l` and reconcile against the plan's pre-registered counts. Record whether the ubuntu leg HIT or MISS-and-saved. |
| The detector goes green on a real `windows-11-arm` runner | XOS-05 | `workflow_dispatch` only fires for workflow files present on the DEFAULT branch, so a new file cannot be dispatched pre-merge | POST-MERGE first-run close, the pattern this repo already uses for `ppe`, `dogfood-*` and `consumer-smoke`. Pre-merge, close the substantive half instead by running `nx run-many -t build typecheck test --skip-nx-cache` on the Windows arm64 workstation. |
| The recipe is correct and safe for a consumer to copy | DOCS-07 | A review judgement about prose, not an assertion | `/gsd:code-review` plus the phrase-keyed drift guard. The guard proves the doc SAYS the right things; only review proves it MEANS them. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Every new guard OBSERVED red before green
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
