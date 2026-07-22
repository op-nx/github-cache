# Quick Task 260721-eac: Address A1 and A2 in this branch - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning
**Mode:** --full --auto (gray areas auto-resolved; HIGH-confidence, evidence-backed)

<domain>
## Task Boundary

Close the two non-blocking "Findings A" the v0.0.1 milestone audit surfaced, on the
current branch `gsd/v0.0.1-greenfield-rebuild` (do NOT branch; the milestone code lives
only here, `origin/main` is the pre-milestone baseline).

- **A1 (tech debt):** the orphaned `trust.generated.cjs` write-trust artifact (TRUST-04).
- **A2 (bookkeeping):** TRUST-07 checkbox is `[ ]` in REQUIREMENTS.md while 04-VERIFICATION
  marks it SATISFIED.
</domain>

<decisions>
## Implementation Decisions (LOCKED - do not revisit)

### A1 disposition: REMOVE the whole trust.generated loop
Confirmed by orchestrator inline before locking (git grep, 2026-07-21): the ONLY references
to `trust.generated.cjs` are the artifact itself, its generator, its parity/drift tests, the
fallow ignore, the CI job, and `.planning/` docs. **No production source `require()`s or
imports it** - both actions reach the write-trust gate via `trust.ts` (compiled into `dist/`
for the internal action; the esbuild single-file bundle for the Phase 6 consumer action).
The Phase 6 esbuild bundling made the raw-`require()` scenario unnecessary; the artifact is
also outside the tsconfig `src/**/*.ts` include so it never ships to `dist/`. TRUST-04's
actual intent (single source + no dual-root drift) is met by `trust.ts` alone once the
generated copy and its guards are gone (nothing left to drift against).

Remove exactly these (KEEP `packages/github-cache/src/lib/trust.ts` = single source of truth):
- `packages/github-cache/src/action/trust.generated.cjs` - the orphaned artifact
- `packages/github-cache/selfcheck.cjs` - the generator/drift-detector CLI
- `packages/github-cache/src/lib/trust.generated.spec.ts` - semantic-parity spec (147 cases)
- `packages/github-cache/src/selfcheck.spec.ts` - the selfcheck.cjs CLI drift-detection test
- `.github/workflows/ci.yml` - the `selfcheck` job (~line 45) + any needs:/reference to it
- `package.json` - the `selfcheck` and `generate:trust` npm scripts (~lines 14-15)
- `.fallowrc.jsonc` - the `trust.generated.cjs` ignore entry (~line 53) + its comment

GATE (security-adjacent removal): the executor MUST re-run
`git grep -n "trust.generated" -- ':!*trust.generated.cjs' ':!*trust.generated.spec.ts' ':!.planning/*'`
and confirm the remaining hits are ONLY the files being removed above. If any OTHER runtime
consumer surfaces, abort A1 and surface it - do not remove blindly.

### A2 disposition: FLIP the checkbox to [x]
`.planning/REQUIREMENTS.md:54` - change `- [ ] **TRUST-07**` to `- [x] **TRUST-07**` for
tidiness. 04-VERIFICATION.md:225 marks it SATISFIED (first-write-wins / no-overwrite; 409 on
existing record + mirror never overwrites; unit-tested). One-character edit, no functional
impact. Leave the `-GHCR` variant (line 87) untouched - it is correctly parked as a
later-milestone item.

### Branch: stay on `gsd/v0.0.1-greenfield-rebuild`
No new branch, no worktree isolation. Executor runs sequentially on the current tree.

### Claude's Discretion
Whether ci.yml's `selfcheck` job removal requires updating any downstream `needs:` arrays -
the executor resolves this by reading ci.yml. Same for the exact package.json script lines.
</decisions>

<specifics>
## Specific Ideas

Verify green after the removal (all three, all must pass):
- `npx nx test github-cache`
- `npm run check:action`
- `npm run fallow:ci` (or the project's fallow gate)

A1's scope removes source files + a CI job + npm scripts; it does NOT touch `package.json`
dependencies or `package-lock.json`, so the Windows npm-install lockfile-prune trap does NOT
apply. If the change unexpectedly touches deps/lockfile, STOP and regenerate the lockfile in a
linux/arm64 node:24 container (see the `windows-npm-install-prunes-linux-optional-deps` memory).
</specifics>

<canonical_refs>
## Canonical References

- `.planning/HANDOFF.json` + `.planning/.continue-here.md` - the paused findings-A handoff.
- `.planning/v0.0.1-MILESTONE-AUDIT.md` - the `tech_debt` block (A1) + integration-checker
  orphan finding for TRUST-04.
- `.planning/phases/04-publish-retention-observability/04-VERIFICATION.md` (~line 225, 238) -
  TRUST-07 SATISFIED + the checkbox-convention note (A2).
- `packages/github-cache/src/lib/trust.ts` - the single source of truth to preserve.
</canonical_refs>
