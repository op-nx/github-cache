# Phase 6 - Deferred Items (out-of-scope discoveries)

Discoveries logged during execution that are NOT caused by the current task's
changes and are therefore out of scope per the executor scope-boundary rule.

## From 06-04 (adoption docs)

- **[RESOLVED 2026-07-21]** **06-05 docs-trust guard had the same stale-cache gap 06-02/06-03 fixed.**
  Fixed during phase-6 execution close-out: `{workspaceRoot}/docs/trust-and-security.md`
  and `{workspaceRoot}/docs/versioning.md` are now wired into `nx.json`
  `targetDefaults.test.inputs`, so editing either doc busts the Nx test cache and
  re-runs the guard. Verified green with `--skip-nx-cache`.

  Original finding:
  `packages/github-cache/src/docs-trust.spec.ts` reads
  `docs/trust-and-security.md` and `docs/versioning.md` via `import.meta.url`,
  but neither file is wired into the `test` target inputs in `nx.json`. As with
  T-06-03-02, editing either doc (e.g. dropping a required topic or an event
  string) would NOT bust the Nx test cache, so the guard could replay a stale
  pass. 06-04 wired ITS OWN guard's five repo-root docs (README + the four new
  docs) into `nx.json`; extending the same fix to the two 06-05 docs is a
  one-line-each addition but belongs to 06-05's scope, not 06-04's. Suggested
  fix: add `{workspaceRoot}/docs/trust-and-security.md` and
  `{workspaceRoot}/docs/versioning.md` to `nx.json` `targetDefaults.test.inputs`.
