---
quick_id: 260719-3el
title: Worktree node_modules sharing strategy - research
date: 2026-07-19
status: complete
---

# Research: git worktree node_modules strategy

Task: document when a worktree's `node_modules` can safely be a junction/symlink to
the main tree vs when to just `npm ci`, covering `node_modules/.cache`,
`node_modules/.vite`, and other shared/race-prone resources.

Method: verified each claim against the live repo (`.gitignore`, `package.json`,
`nx.json`, GSD `quick.md` workflow source) rather than re-deriving from memory.

## Claim verification

| # | Claim (from prior session / memory) | Verdict | Evidence |
|---|-------------------------------------|---------|----------|
| 1 | A fresh worktree lacks `node_modules` | TRUE | `git worktree add` checks out only *tracked* files at the commit; `node_modules` is gitignored (`.gitignore:9`), so it is never copied in. `.nx/`, `.env` etc. are likewise absent. |
| 2 | A junction/symlink from the worktree's `node_modules` to the main tree's gives installed deps with no per-worktree `npm ci` | TRUE (deps-unchanged only) | A directory junction makes the worktree resolve the same installed packages. Valid only while `package.json`/lockfile match main. |
| 3 | Deps-unchanged is the load-bearing condition | TRUE | If a plan edits `package.json`/lockfile, the junctioned `node_modules` is main's set - stale/wrong for the new deps. That plan needs its own `npm ci` (or sequential-on-main). |
| 4 | Concurrent-write race on `node_modules/.vite` / `.cache` | TRUE, with a correction | `node_modules` is read-only during build/test EXCEPT tool caches written inside it. Two worktrees junctioned to the same `node_modules` running Vitest at once share the same physical `.vite` -> race. |
| 4a | Fix via a `VITE_CACHE_DIR` / `CACHE_DIR` env var | **FALSE - correction** | Vite has **no `VITE_CACHE_DIR` env var**. The cache location is the `cacheDir` *config option* (default `node_modules/.vite`); Vitest stores its cache under Vite's `cacheDir`. Per-worktree isolation is done in config, not via an env var. |
| 5 | GSD `isolation="worktree"` won't create the junction | TRUE | The `quick.md` / execute-phase workflows only run `git worktree add`; the junction must be a custom pre-dispatch step. Not a config flag today. |
| 6 | Let each worktree keep its own `.nx/` rather than share | TRUE - and it's the default | `.nx/cache` + `.nx/workspace-data` live at the *worktree root* (`.gitignore:41-42`), not inside `node_modules`, and Nx 23 uses the default `.nx/cache`. A junctioned `node_modules` does NOT share `.nx/`; each worktree naturally regenerates its own. |
| 7 | For a small workspace, `npm ci` "isn't a big deal" | TRUE (project-context) | This is a small Nx workspace; a per-worktree `npm ci` is cheap enough to be the safe default, sidestepping every cache-race concern. The junction is an optimization, not the baseline. |

## Project-specific facts

- Runner: **Vitest ~4.1 + Vite ^8** via `@nx/vitest` 23.1.0. Vite `cacheDir` default
  `node_modules/.vite` -> that path is a real write target during `nx test`.
- Nx cache: `.nx/cache` (workspace-root, gitignored) - per-worktree by default.
- `node_modules/.cache` is a generic tool-cache convention (babel-loader et al.);
  same race profile as `.vite` when `node_modules` is junctioned.

## Recommendation

Decision rule, defaulting to the simple option:
1. Plan changes deps -> own `npm ci` or sequential-on-main (never share).
2. Deps unchanged + independent plans -> `npm ci` per worktree (default), or junction
   `node_modules` to skip install if install time hurts.
3. Sequentially-dependent plans -> sequential-on-main; no parallelism to gain.

When junctioning: caches inside the shared `node_modules` (`.vite`, `.cache`) race -
move them per-worktree via the Vite `cacheDir` config option (no env var exists), or
just `npm ci` per worktree. `.nx/` is already per-worktree.
