---
phase: 13
slug: read-only-actions-cache-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map is filled
> at plan time (task IDs do not exist until PLAN.md files are written) and audited post-execution
> by `/gsd:validate-phase`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest, via `@nx/vitest` (`nx.json:28-32`, `testTargetName: "test"`) |
| **Config file** | `packages/github-cache/vitest.config.mts` |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npm run test` (= `nx run-many -t test`) |
| **Bundle drift check** | `npm run check:action` — **MAIN TREE ONLY** (a junctioned worktree reports false drift) |
| **Estimated runtime** | package suite is fast; the from-disk CI pins are cheap |

---

## Sampling Rate

- **After every task commit:** `npx nx test github-cache`
- **After every plan wave:** `npm run test` **plus** `npm run check:action` from the main tree.
  The bundle check is NOT part of `nx test` and is the single most likely thing to be forgotten —
  editing any `serve()`-reachable source drifts the committed `start-cache-server/index.js`.
- **Before `/gsd:verify-work`:** full suite green + `check:action` clean + a real CI run showing all
  three gated Windows legs green.
- **Post-merge, separate PR:** the Q4 Case-B observation. Do NOT fold it into the landing commit —
  that commit rotates all three hashes, so every leg takes the intra-run merge-ref path (Case A)
  and cannot exhibit Case B.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _filled at plan time_ | — | — | VER-08 / VER-09 / TRUST-14 / XOS-09 / TEST-11 / DOCS-09 / DOCS-10 | see PLAN.md `<threat_model>` | — | — | — | — | ⬜ pending |

**Requirement → behavior coverage (from RESEARCH.md; the planner maps these onto task IDs):**

| Req | Behavior | Command | Exists? |
|-----|----------|---------|---------|
| VER-08 | Exactly one `cache.restoreCache` READ site; ordered `cache.*` members unchanged | `npx nx test github-cache -- actions-cache-backend` | YES — `actions-cache-backend.spec.ts:517-531`, passes unchanged |
| VER-08 | Read-only factory returns a `ReadableBackend` with NO `put`; `isWritableBackend` false | same | NO — Wave 0 |
| VER-08 | Both factories share ONE `get` — read-only and writable restore identically | same | NO — Wave 0 |
| VER-08 | VER-04 guards fire from the READ-ONLY factory too (wrong cwd throws; divergent `GITHUB_WORKSPACE` throws) | same | NO — Wave 0 |
| VER-08 | `enableCrossOsArchive` still at the 5th/4th/5th positional across all three sites | same | YES — `:431-488`, must stay green |
| VER-09 | Exactly one non-spec module under `src/` imports `@actions/cache` | same | NO — Wave 0 |
| TRUST-14 | `selectBackend.length === 0` unchanged | `npx nx test github-cache -- select-backend` | YES — `select-backend.spec.ts:298-305` |
| TRUST-14 | Knob set + fully write-trusted env → read-only Actions backend | same | NO — Wave 0 |
| TRUST-14 | **Narrowing-only, exhaustive (LOAD-BEARING):** for every enumerated env shape, the knob NEVER makes writable what was not writable without it. Assert the implication in the correct direction — `writable(withKnob) => writable(withoutKnob)` — never a negated matcher inside a single call assertion | same | NO — Wave 0 |
| TRUST-14 | Truthiness: a non-empty typo value still NARROWS (fail-safe direction) | same | NO — Wave 0 |
| XOS-09 | Each Windows leg writes the read-only knob to `$GITHUB_ENV` | `npx nx test github-cache -- dogfood-cross-os` | NO — Wave 0 |
| XOS-09 | Each leg's count is COMPARED and the comparison can fail — **assert the comparison line, never `exit 1`** | same | NO — Wave 0 |
| XOS-09 | The gate actually reddens on a real cross-OS restore failure | CI-only behavioural | record a run id |
| TEST-11 | `RECORDED, never gated` absent from all three job blocks | same | NO — Wave 0 |
| TEST-11 | New clauses are NON-VACUOUS (mutation-proven) | manual, recorded | mutate the gate step out; confirm the clause reddens and nothing else does |
| DOCS-09 | No stale site survives (SEVEN sites, not four) | `git grep -n "RECORDED, never gated\|WRITABLE sidecar" -- .github packages` returns nothing | partially automated |
| DOCS-10 | Knob documented in `configuration.md` | `npx nx test github-cache -- docs-adoption` | YES — `docs-adoption.spec.ts:52-54,82` |
| DOCS-10 | `EXPECTED_ENV_KNOBS` matches the reviewed inline literal | `npx nx test github-cache -- public-surface` | YES — `public-surface.spec.ts:159-170`; **will FAIL until the literal is updated — that failure IS the reviewable diff** |
| DOCS-10 | `advanced.md` documents FIVE outcomes, not four | `npx nx test github-cache -- docs-adoption` | NO — Wave 0 (`advanced.md:21` hardcodes "FOUR") |
| (bundle) | Committed bundle matches source | `npm run check:action` | YES — `package.json:18`, `ci.yml:128` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/github-cache/src/backend/actions-cache-backend.spec.ts` — new describes for the
      read-only factory (no `put`; shared `get`; VER-04 guards fire from it) — VER-08
- [ ] `packages/github-cache/src/backend/actions-cache-backend.spec.ts` — the package-scope
      `@actions/cache` importer scan — VER-09
- [ ] `packages/github-cache/src/lib/select-backend.spec.ts` — the knob's read-only outcome, the
      exhaustive narrowing-only table, and truthiness semantics — TRUST-14
- [ ] `packages/github-cache/src/dogfood-cross-os.spec.ts` — three new per-leg clauses (knob write,
      count comparison, absent revert marker) plus their reason strings — XOS-09 / TEST-11
- [ ] Framework install: **none needed** — Vitest is present and configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The gate reddens on a real cross-OS restore failure | XOS-09 | Only observable on a real `windows-11-arm` runner after a ubuntu leg has saved | Land the change; record the run id showing all three gated legs green; then confirm the failure direction by the TEST-11 mutation check rather than by breaking CI |
| New gate clauses are non-vacuous | TEST-11 | Vacuity is a property of the assertion, not of the run | Mutate the gate step out of one leg; confirm exactly the intended clause reddens. **`ci.yml:527` is already `exit 1`, so a clause matching `/exit 1/` is green today, before any change** |
| PR restores from the base/default-branch scope (Case B) | Q4 | This phase's landing commit rotates all three hashes, so every leg takes the intra-run merge-ref path (Case A) | Separate later PR that touches no declared `build`/`typecheck`/`test` input; see RESEARCH.md Q4 for the procedure |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] `check:action` run from the MAIN tree, not a worktree
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
