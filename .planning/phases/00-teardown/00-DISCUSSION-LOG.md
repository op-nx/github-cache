# Phase 0: Teardown - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 0-Teardown
**Mode:** `--auto --analyze --chain` (autonomous single-pass; recommended option selected per area; trade-off tables logged for audit)
**Areas discussed:** Removal mechanics, nx.json cleanup depth, Cross-OS invariant preservation, verdaccio/local-registry, CI rework shape, De-priming sequence

> **Trap-quadrant check (per `--auto` policy):** every area below was rated HIGH-CONFIDENCE
> because the choice is dictated by the ROADMAP Phase 0 success criteria / risk notes or by a
> captured memory. None landed in the HIGH-IMPACT + NOT-HIGH-CONFIDENCE trap quadrant, so
> autonomous selection is safe. The one mild judgment (verdaccio breadth, D-04) is flagged
> LOW-DEFERENCE / re-openable rather than auto-locked as settled precedent.

---

## Removal mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Generator only | `nx g @nx/workspace:remove` and trust it to clean everything | |
| Generator + manual siblings | Generator removes the project; manually remove `start-cache-server/`, `publish-mirror/`, `.verdaccio/`; verify graph + `run-many` | check |

**Auto-selected:** Generator + manual siblings.
**Notes:** The generator owns only the Nx project, not the sibling action dirs or `.verdaccio/`. SC1 names all of them explicitly. Graph resolution + a clean `nx run-many` are the concrete dangling-reference gate.

---

## nx.json cleanup depth

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Keep all targetDefaults untouched | |
| Targeted scrub | Remove dangling `typecheck` tsconfig paths + PoC `externalDependencies`; keep the rest | check |
| Full reset | Regenerate nx.json from scratch | |

**Auto-selected:** Targeted scrub.
**Notes:** `nx.json:124-125` hard-codes paths into the deleted project (dangling per SC1). `@actions/cache`/`@octokit/rest` externalDependencies were PoC-only. Full reset would disturb workspace-shell invariants (SC4).

---

## Cross-OS invariant preservation

| Option | Description | Selected |
|--------|-------------|----------|
| Strip unused | Remove the `integration` discriminator + `.gitattributes eol=lf` since nothing consumes them post-teardown | |
| Keep dormant | Preserve `.gitattributes eol=lf` + the `{runtime: node -p process.platform}` discriminator as Phase 3 foundation | check |

**Auto-selected:** Keep dormant.
**Notes:** ROADMAP Phase 0 risk note is explicit ("must not disturb ... even though nothing consumes them yet"). Memory `os-sensitive-nx-hash-discriminator` proves the runtime-input recipe is hash-parity-correct and shell-invariant. Stripping would force Phase 3 to re-derive it and risk reopening the silently-failed CRLF/cross-OS bugs.

---

## verdaccio / local-registry

| Option | Description | Selected |
|--------|-------------|----------|
| Keep for Phase 6 | Retain `verdaccio` devDep + `local-registry` target for future publish testing | |
| Remove now | Remove the target + devDep coupled to the deleted `.verdaccio/config.yml` | check |

**Auto-selected:** Remove now. **[LOW-DEFERENCE / re-openable]**
**Notes:** SC1 deletes `.verdaccio/`; a `local-registry` target pointing at the deleted config is a dangling ref. This breadth call is a mild judgment (not verbatim in the success criteria) - Phase 6 re-adds a publish-test harness via `nx g` if needed.

---

## CI rework shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal 5-job LOCAL-cache baseline | Keep format-check/build/typecheck/test + ubuntu+windows integration matrix; drop all cache coupling; delete mirror-cleanup.yml | check |
| Strip to a single job | Collapse to one lint/build job, drop the matrix | |

**Auto-selected:** Minimal 5-job LOCAL-cache baseline.
**Notes:** SC2 (delete mirror-cleanup.yml; remove start-cache-server/nx-reset reseed/windows-selfcheck/publish-mirror) + SC3 (the 5 jobs on LOCAL cache) are verbatim. The `windows-11-arm` integration leg is preserved so Phase 3's cross-OS matrix infra is ready. Reduce `permissions` to `contents: read`.

---

## De-priming sequence

| Option | Description | Selected |
|--------|-------------|----------|
| Run map-codebase last | After teardown commits land, so the map reflects the torn-down state | check |
| Run map-codebase first | Regenerate before teardown | |

**Auto-selected:** Run map-codebase last.
**Notes:** SC5 - the regenerated `.planning/codebase/*` must show no PoC trace, which is only true after the PoC is deleted.

---

## Claude's Discretion

- Exact `nx g @nx/workspace:remove` flags (resolve at plan/execute time against `--help`).
- Commit granularity for the manual directory deletions vs the generator run.
- Whether the root `package.json` `integration` script stays (recommend keep - project-agnostic no-op).

## Deferred Ideas

- verdaccio / local-registry publish testing -> Phase 6 (Distribution + Docs).
- Unpackaged spikes (`.planning/spikes/MANIFEST.md`, no findings skill) - verdicts already consumed into PROJECT.md / ARCHITECTURE-DECISION.md; no action for Phase 0.
