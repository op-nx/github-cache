<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

<!-- Content below is NOT managed by Nx - keep it outside the markers above. -->

# Git worktree strategy (parallel plan execution)

When a phase has genuinely independent plans, executors can run in isolated git
worktrees (`isolation="worktree"`). A fresh worktree checks out only *tracked*
files, so untracked and gitignored paths - `node_modules`, `.nx/cache`, a local
`.env` - are absent. That absence is NOT a reason to serialize. Pick per the
decision rule.

## Decision rule (default to the simple option)

- **Plan changes deps** (edits `package.json` / `package-lock.json`) -> it must NOT
  share the main tree's `node_modules`. Give it its own `npm ci`, or run it
  sequential-on-main. Sharing stale deps is wrong, not just slow.
- **Deps unchanged AND plans independent** -> `npm ci` per worktree (default), or
  share deps via a junction (below) to skip the install. This workspace is small,
  so `npm ci` is cheap - reach for the junction only if install time actually hurts.
- **Plans sequentially dependent** (each imports the prior) -> no parallelism to
  gain; run sequential-on-main regardless of `node_modules`.

## Sharing node_modules via a junction (deps-unchanged only)

`isolation="worktree"` runs `git worktree add` only - it does NOT create the
junction. Add it as a pre-dispatch step, before the executor runs, from the
worktree root (target must be an absolute path to the main tree's `node_modules`):

- Windows (PowerShell): `New-Item -ItemType Junction -Path node_modules -Target <main>\node_modules`
- Windows (cmd): `mklink /J node_modules <main>\node_modules`
- macOS / Linux: `ln -s <main>/node_modules node_modules`

Only valid while `package.json` / lockfile match the main tree. If they diverge,
the junction serves stale deps - fall back to `npm ci`.

## Shared / race-prone resources

A junctioned `node_modules` is read-only during build/test EXCEPT for tool caches
written *inside* it. Two worktrees junctioned to the same `node_modules` running
tests at once race on:

- `node_modules/.vite` - Vite's `cacheDir` default; Vitest (this repo's runner, via
  `@nx/vitest`) stores its cache under it. The main collision point.
- `node_modules/.cache` - generic tool-cache convention (babel-loader, etc.).

To share deps without racing caches, point the cache OUT of the junctioned tree per
worktree via the Vite `cacheDir` config option (resolved per worktree). There is NO
`VITE_CACHE_DIR` environment variable - the knob is `cacheDir` in the Vite / Vitest
config. Simpler: skip the junction and `npm ci` per worktree, which isolates every
cache automatically.

`.nx/cache` and `.nx/workspace-data` live at the *worktree* root (not in
`node_modules`) and are gitignored, so each worktree already gets its own - let each
regenerate its Nx cache rather than sharing it (shared Nx cache state across parallel
worktrees is riskier than sharing `node_modules`).
