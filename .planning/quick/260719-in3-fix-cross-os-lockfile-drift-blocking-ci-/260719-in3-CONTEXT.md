# Quick Task 260719-in3: Fix cross-OS lockfile drift blocking CI - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Task Boundary

Fix the `package-lock.json` cross-OS drift that makes CI `npm ci` fail on every job
(and blocks the Phase 2 dogfood cache-HIT canary). Regenerate a lockfile that is
complete and installable on both `ubuntu-24.04-arm` and `windows-11-arm`, without
hand-editing it and without disturbing the exact-pinned `@actions/*` deps.
</domain>

<decisions>
## Implementation Decisions (auto-locked, evidence-backed)

### Regeneration environment
- Regenerate in a Linux arm64 `node:24` Docker container (matches CI `lts/krypton`),
  `node_modules` masked, `npm install --package-lock-only`. A Windows regen prunes the
  Linux optional deps and cannot fix it.

### Verification bar
- `npm ci` must exit 0 on BOTH Linux (Docker) and Windows (local) -- CI runs `npm ci`
  on both. Plus full local gate (100 tests, typecheck, build, fallow dead-code, format,
  `test:act` self-skip) AND the real `main`-push CI run (dogfood HIT).

### Scope of lockfile change
- Accept the incidental prune of 284 stale `@verdaccio/*` / `@cypress/*` PoC-leftover
  entries (no longer declared) -- correct cleanup, not scope creep. Preserve all win32
  bindings and the `@actions/cache@6.2.0` / `@actions/core@3.0.1` exact pins.

### Execution mode
- Run sequential on the main tree, NOT in a worktree: this task changes
  `package-lock.json`, and per AGENTS.md a dep-changing task must not run against a
  worktree lacking `node_modules`; the fix also requires a Linux regen a Windows
  worktree cannot produce.

### Claude's Discretion
- Commit message wording, artifact structure.
</decisions>

<specifics>
## Specific Ideas

The dogfood canary (`dogfood-seed` -> `dogfood-verify`, keyed on `github.run_id`) is the
end-to-end proof; a green verify job IS the SC5 / ROBUST-03 confirmation the phase awaited.
</specifics>

<canonical_refs>
## Canonical References

- AGENTS.md "Git worktree strategy" -> dep-changing tasks must not share/lack node_modules.
- `.planning/phases/02-default-cache-in-ci/02-VERIFICATION.md` (the `human_needed` HIT item).
- CLAUDE.md: never hand-edit the lockfile; regenerate via npm.
</canonical_refs>
