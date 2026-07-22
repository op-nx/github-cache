# Phase 0: Teardown - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the spike/PoC cache project (`@op-nx/github-cache`) and all its cache-coupled
CI, leaving the Nx workspace SHELL intact and green with a lean, project-agnostic
baseline CI that passes whether or not any remote cache exists - then de-prime the
codebase map so it no longer describes the deleted PoC.

This is a prep phase: it delivers **no v0.0.1 requirement**. It clears the ground for the
greenfield rebuild (sunk cost = 0). "HOW to tear down cleanly" is in scope; adding any
new capability is not (that starts Phase 1).

</domain>

<decisions>
## Implementation Decisions

### Removal mechanics
- **D-01:** Remove `@op-nx/github-cache` with `nx g @nx/workspace:remove` (Nx-native, ROADMAP-mandated) - exact flags resolved at plan/execute time. The generator removes the project + its graph entry; it does NOT own the sibling directories, so **manually remove** `start-cache-server/`, `publish-mirror/`, and `.verdaccio/`. After removal, verify the project graph resolves with **zero dangling references** and a clean `nx run-many` succeeds (ROADMAP Phase 0 risk: dangling tsconfig aliases / `nx.json` targetDefaults / root `package.json` scripts).

### nx.json cleanup depth
- **D-02:** Scrub PoC-specific residue from `nx.json` `targetDefaults`, keep the rest:
  - REMOVE the hard-coded relative paths in `typecheck.inputs` pointing at the deleted project - `^{projectRoot}/../../../../../../../packages/op-nx-github-cache/tsconfig.lib.json` and `...tsconfig.spec.json` (`nx.json:124-125`) - they become dangling after removal (SC1).
  - REMOVE the PoC-only `externalDependencies` entries `@actions/cache` and `@octokit/rest` from `build.inputs` and `typecheck.inputs` (they were the cache project's deps; not in root `package.json`).
  - KEEP `namedInputs`, `plugins` (`@nx/js/typescript`, `@nx/vitest`), `analytics: false`, `release.version.preVersionCommand`, and the `test`/`build`/`typecheck` target defaults' generic parts.

### Cross-OS invariant preservation (dormant, load-bearing)
- **D-03:** KEEP `.gitattributes eol=lf` AND the `integration` targetDefault in `nx.json` - **including** the `{ runtime: "node -p process.platform" }` discriminator (`nx.json:60-74`) - even though NO project consumes them after teardown. These are the foundation Phase 3's cross-OS correctness stands on (ROADMAP Phase 0 risk note: "must not disturb the load-bearing workspace invariants ... even though nothing consumes them yet"; memory `os-sensitive-nx-hash-discriminator`). Do NOT re-derive this in Phase 3; inherit it. The discriminator is a runtime input (shell-invariant, hash-parity proven), NOT `env:RUNNER_OS`.

### verdaccio / local-registry
- **D-04:** Remove the local-registry publish scaffold that is coupled to the deleted `.verdaccio/`: the `nx.targets.local-registry` target (`@nx/js:verdaccio`, `package.json:37-45`) and the `verdaccio` devDependency (`package.json:27`). SC1 deletes `.verdaccio/config.yml`, so leaving the target pointing at it is a dangling reference. **[LOW-DEFERENCE / re-openable]** - this is a mild breadth judgment, not dictated verbatim by the success criteria; Phase 6 (Distribution) re-adds a local-registry publish-test path via `nx g` if it needs one. Flagged so a Phase 6 planner treats it as an open choice, not settled precedent.

### CI rework shape
- **D-05:** Delete `.github/workflows/mirror-cleanup.yml` entirely. Rework `.github/workflows/ci.yml` to keep FIVE jobs on Nx's LOCAL cache only - `format-check`, `build`, `typecheck`, `test`, and an ubuntu+windows `integration` matrix (SC2/SC3). Specifically:
  - DROP: the `windows-selfcheck` job, the `publish-mirror` job, every `- uses: ./start-cache-server` step, and the `build` job's `npx nx reset` + second-build reseed dance (`ci.yml:54-55`).
  - KEEP the project-agnostic mechanics: `push: [main]` + `pull_request` triggers, `npx nx format:check --all` (the PR-checkout diff-base workaround, `ci.yml:23-25`), `ubuntu-24.04-arm` runners, `node-version-file: .node-version` + `cache: 'npm'`, `npm ci`.
  - The `integration` matrix stays as scaffolding (`nx run-many -t integration` is a green no-op until Phase 1 adds an `integration` target); preserve the `windows-11-arm` leg so the cross-OS matrix infrastructure is ready for Phase 3. `fail-fast: false` retained on the matrix.
  - Reduce workflow `permissions` to `contents: read` only (no `actions: read` needed once the Actions-cache jobs are gone).

### De-priming sequence
- **D-06:** Run `/gsd:map-codebase` to regenerate `.planning/codebase/*` against the torn-down (shell-only) workspace, then confirm no rebuild-priming artifact remains (SC5). Sequence this **LAST** in the phase - after the teardown commits land - so the regenerated map reflects the deleted-PoC state, not the pre-teardown one. (The `.planning/research/*` brownfield->greenfield reframe and the PROJECT.md reconciliation were already done at planning time; only the map regeneration remains.)

### CI format gate (SC3) - added post-research
- **D-07:** Make `nx format:check --all` green by adding the agent + planning docs to `.prettierignore`: `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.planning/`. RESEARCH.md found `--all` currently exits 1 on unformatted TRACKED docs (none are workspace source) and SC5's map-codebase writes more `.planning` markdown, so the kept `--all` mechanic would ship a red gate. Keep the gate on real source only. Project-local / dogfood-safe (aligns with the `dogfood-changes-stay-consumer-safe` rule). Do NOT reformat the repo-wide docs instead (would fight the tools that generate them and churn every future plan edit). Keep the existing `.prettierignore` entries (`/dist`, `/coverage`, `/.nx/cache`, `/.nx/workspace-data`, `.nx/self-healing`). (User-confirmed 2026-07-18.)

### README de-priming (SC5) - added post-research
- **D-08:** Minimal shell rewrite of root `README.md`. The current README describes the deleted PoC (calls `op-nx-github-cache` "the only package", has a broken link) - a rebuild-priming artifact SC5 forbids. Trim to a neutral workspace-shell placeholder (project name + "greenfield rebuild in progress", no PoC references, no dead links). Do NOT pre-write Phase 6's adoption docs. (User-confirmed 2026-07-18.)

### Claude's Discretion
- Exact `nx g @nx/workspace:remove` flags - RESEARCH.md pinned the contract: `nx g @nx/workspace:remove @op-nx/github-cache` (no `--forceRemove` needed - zero dependents; `--dry-run` verified it DELETEs `packages/op-nx-github-cache/` + UPDATEs root `tsconfig.json` only). Still resolve final flags against `--help` at execute time per ROADMAP.
- Exact ordering of the manual directory deletions and whether they ride in the same commit as the generator run or a follow-up commit.
- Whether the root `package.json` `integration` script (`nx run-many -t integration`) stays - recommend KEEP (project-agnostic, green no-op, matches the retained CI job).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec (authoritative for Phase 0)
- `.planning/ROADMAP.md` -> "Phase 0: Teardown" - the 5 Success Criteria + the two Risks are the phase contract. Also "De-priming gate (Phase 0 -> Phase 1)" and "Rebuild method is Nx-native".
- `.planning/PROJECT.md` -> "Constraints" + "Context" - workspace-shell invariants (nx.json, root tsconfigs, vitest.workspace, root package.json, `.gitattributes eol=lf`), cross-OS parity as load-bearing, the silent-failure history (CRLF hash divergence + cross-OS publish gap) that must not reopen.

### Grounding (LOCKED; not Phase 0 work, but the rebuild target the torn-down ground makes way for)
- `.planning/ARCHITECTURE-DECISION.md` - Decision record + CREEP control ledger C1-C18.
- `.planning/REQUIREMENTS.md` - locked v0.0.1 requirement set (Phase 0 delivers none; Phases 1-6 do).

### Reference-only (describe the PoC being torn down; regenerated by SC5)
- `.planning/codebase/ARCHITECTURE.md`, `STACK.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `CONCERNS.md`, `TESTING.md` - historical map of the PoC. Do NOT treat as current state or code to extend; `/gsd:map-codebase` regenerates them at the end of this phase.
- `.planning/research/PITFALLS.md` -> "Empirically-Verified Platform Facts" - cross-OS parity, CRLF, `@actions/cache` literal-temp-path version-hashing. Implementation-independent; stays true after teardown.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable / preserved assets (the workspace SHELL - keep intact)
- `nx.json` - keep; targeted scrub only (D-02) + preserve the cross-OS `integration` discriminator (D-03).
- `tsconfig.base.json`, `tsconfig.json`, `vitest.workspace.ts`, root `package.json` scripts (`build`/`typecheck`/`test`/`integration`/`format`/`format:check` = `nx run-many`/`nx format:*`), `.gitattributes eol=lf` - all workspace shell; keep.
- Remaining project after removal: `@op-nx/source` (the workspace root project). `nx build`/`nx test`/`nx run-many` must resolve green post-teardown (SC4) - with no cache-project targets left, `run-many` is a benign green no-op.

### To remove
- `packages/op-nx-github-cache/` (via `nx g @nx/workspace:remove`).
- `start-cache-server/`, `publish-mirror/`, `.verdaccio/` (manual - generator doesn't own siblings).
- `.github/workflows/mirror-cleanup.yml` (whole file).
- `verdaccio` devDep + `nx.targets.local-registry` in root `package.json` (D-04).

### Integration points (files reworked in place)
- `.github/workflows/ci.yml` - rework to the 5-job LOCAL-cache-only baseline (D-05).
- `nx.json` `targetDefaults` - scrub dangling PoC refs, keep the `integration` discriminator (D-02, D-03).

</code_context>

<specifics>
## Specific Ideas

- The reworked baseline CI must be a "passes green whether or not any remote cache exists" skeleton - deliberately doing very little now, sized to receive Phase 1's new lib. The integration matrix is intentionally an empty-but-present scaffold, not dead weight to delete.
- The Nx project graph check + a clean `nx run-many` are the concrete "no dangling reference" gate (SC1) - treat a graph resolution error or a `run-many` failure as a teardown regression, not noise.

</specifics>

<deferred>
## Deferred Ideas

- **verdaccio / local-registry publish testing** -> Phase 6 (Distribution + Docs), if the npm-package publish flow wants a local-registry harness. Removed here only because it is coupled to the deleted `.verdaccio/`.
- **PoC-era GitHub remote cache cleanup** (D-09, user-confirmed 2026-07-18): PoC-era remote Actions-cache entries + `cache-mirror-*` Release assets are DEFERRED - not a Phase 0 SC, harmless once nothing reads them post-teardown, and cleanable anytime. Do NOT delete them in this teardown (would add outward-facing remote scope beyond the SCs).
- **Unpackaged spikes note (informational):** `.planning/spikes/MANIFEST.md` exists with no findings skill, but the spike verdicts (FOUND-01 = GitHub Releases) are already consumed into `PROJECT.md` / `.planning/ARCHITECTURE-DECISION.md`. No packaging action needed for Phase 0.

None else - discussion stayed within phase scope.

</deferred>

---

*Phase: 0-Teardown*
*Context gathered: 2026-07-18*
