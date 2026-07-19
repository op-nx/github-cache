---
quick_id: 260719-3el
title: Add worktree strategy to AGENTS.md
date: 2026-07-19
status: complete
commit: fb5e51a
---

# Summary: Add worktree strategy to AGENTS.md

## What was done

Added a `# Git worktree strategy (parallel plan execution)` section to `AGENTS.md`,
placed OUTSIDE the `<!-- nx configuration start/end -->` managed block so Nx's
auto-update never clobbers it. Committed as `fb5e51a` (55 insertions).

## Contents of the section

- **Decision rule** (defaults to the simple option): deps-changed -> own `npm ci` /
  sequential; deps-unchanged + independent -> `npm ci` per worktree (default) or
  junction to skip install; sequentially-dependent -> sequential-on-main.
- **Junction commands**: Windows `New-Item -ItemType Junction` (+ cmd `mklink /J`),
  unix `ln -s` - valid only while deps match main.
- **Race-prone resources**: `node_modules/.vite` (Vite/Vitest cache), `node_modules/.cache`
  (generic tool cache), and `.nx/cache` (per-worktree by default at worktree root).
- **Correction carried in**: no `VITE_CACHE_DIR` env var exists; the cache knob is the
  Vite `cacheDir` config option.
- Notes that GSD `isolation="worktree"` runs `git worktree add` only and does not
  create the junction (custom pre-dispatch step).

## Verification of prior-session claims

Research (RESEARCH.md) verified each claim against the live repo. All held except
the `VITE_CACHE_DIR` env var, which does not exist - corrected in the doc to the
Vite `cacheDir` config option. Project facts confirmed: node_modules gitignored,
Vitest 4.1/Vite 8 via @nx/vitest 23.1.0, Nx cache at `.nx/cache`.

## Execution mode

Ran sequential-on-main: single plan, no deps change, no parallelism to gain, and the
feature branch has unpushed commits (worktree baseRef staleness risk). This is the
exact case the documented strategy says NOT to worktree-isolate.
