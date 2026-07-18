# Codebase Concerns

**Analysis Date:** 2026-07-18

## Summary

This is a freshly torn-down Nx workspace shell (post Phase 0 teardown). The only project is the workspace root `@op-nx/source` (`package.json`); there is no `packages/*` project (`packages/` contains only `packages/.gitkeep`), no `src/`, and no application code. There are no TODO/FIXME/HACK/XXX markers anywhere in tracked files, no test files, no runtime dependencies (`package.json` `dependencies: {}`), and no known bugs, security issues, or fragile modules to report because there is effectively nothing running yet.

The greenfield rebuild starts in Phase 1. The few items below are dormant scaffolding notes, not defects — they are documented here so a future phase doesn't mistake them for oversights.

## Tech Debt

None. There is no application code yet to accrue debt in.

## Known Bugs

None found. No source files, no runtime behavior to exhibit a bug.

## Security Considerations

None applicable yet — no network-facing code, no auth, no data handling. `.github/workflows/ci.yml` scopes `permissions: contents: read` at the workflow level, which is a reasonable default to carry forward once jobs are added that need broader scopes.

## Performance Bottlenecks

None — no code executes at runtime.

## Fragile Areas

None. There is no implementation to be fragile.

## Scaling Limits

Not applicable at this stage.

## Dependencies at Risk

None. `package-lock.json` contains a `verdaccio` entry, but it is a transitive optional peer dependency pulled in by `@nx/js` (visible under `node_modules/@nx/js`'s dependency tree in the lockfile) — not a dangling reference to removed code and not something the workspace invokes directly. No action needed.

## Missing Critical Features

Everything — this is intentional. The workspace has no application, no library packages, no cache backend implementation. Phase 1 of the roadmap (see `.planning/`) is where this starts.

## Test Coverage Gaps

None to report — there is no source to cover. `vitest.workspace.ts` exists at the root as workspace-level Vitest wiring but no project currently defines a `test` target with actual spec files.

## Dormant CI/Nx Scaffolding (informational, not a concern)

- **`nx.json` `targetDefaults.integration`** and **`.github/workflows/ci.yml`'s `integration` job** (ubuntu-24.04-arm + windows-11-arm matrix) are wired up but currently a green no-op: no project defines an `integration` target yet. The `integration` targetDefault carries a `{ runtime: "node -p process.platform" }` hash discriminator specifically so a future OS-sensitive integration target (real sockets/filesystem) gets separate Linux/Windows cache entries instead of a false cache hit across OSes. This is deliberate groundwork for Phase 1+/Phase 3, documented inline in `.github/workflows/ci.yml`'s `integration` job comment — not dead weight to prune.
- **`.planning/STATE.md`** contains some GSD-tool-generated em-dash (non-ASCII) characters. `.prettierignore` excludes `.planning/` from formatting (see line 9, under the "Agent and planning docs - churny, not workspace source (D-07)" comment), so this does not trigger lint/format failures. No fix needed.

---

*Concerns audit: 2026-07-18*
