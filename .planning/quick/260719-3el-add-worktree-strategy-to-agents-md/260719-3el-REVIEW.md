---
phase: 260719-3el-add-worktree-strategy-to-agents-md
reviewed: 2026-07-19T00:00:00Z
depth: quick
files_reviewed: 1
files_reviewed_list:
  - AGENTS.md
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Quick 260719-3el: Documentation Accuracy Review

**Reviewed:** 2026-07-19
**Depth:** quick
**Files Reviewed:** 1 (AGENTS.md, "# Git worktree strategy" section, lines 27-77)
**Status:** clean (technically accurate)
**Commit reviewed:** 2f669c9

## Summary

The new "Git worktree strategy" section is technically accurate. All six
load-bearing claims were verified against the live repo (`.gitignore`,
`package.json`, `nx.json`) and the section's own `260719-3el-RESEARCH.md`. Every
command is syntactically correct with the correct argument order, and the two
claims most likely to be wrong (the non-existent `VITE_CACHE_DIR` env var and the
`ln -s` target/link ordering) are both stated correctly.

One trivial illustrative-labeling nit is noted below as INFO; it does not affect
the correctness of any guidance and needs no fix to ship.

### Verification results (all pass)

1. **Tracked-files-only / gitignored absent** (lines 30-32): CORRECT. `git
   worktree add` checks out only tracked files; `node_modules` (.gitignore:9),
   `.nx/cache`, `.nx/workspace-data` (.gitignore:41-42) are all gitignored and
   therefore absent from a fresh worktree.

2. **Junction / symlink commands** (lines 51-53): ALL CORRECT.
   - PowerShell `New-Item -ItemType Junction -Path node_modules -Target <main>\node_modules`
     - valid; `-Path` is the link, `-Target` is the target. Junction requires an
     absolute directory target, which the doc explicitly states (line 49).
   - cmd `mklink /J node_modules <main>\node_modules` - correct order
     (`mklink /J <link> <target>`).
   - unix `ln -s <main>/node_modules node_modules` - correct order (TARGET then
     LINK), the exact trap called out in the review brief.

3. **"No VITE_CACHE_DIR env var; the knob is the `cacheDir` config option"**
   (lines 68-72): CORRECT. Vite exposes cache location only through the `cacheDir`
   config option; there is no such environment variable.

4. **`node_modules/.vite` is the Vite/Vitest cache default** (line 65): CORRECT.
   Vite's default `cacheDir` is `node_modules/.vite`; Vitest 4.x stores its cache
   under Vite's `cacheDir`. Runner confirmed: `@nx/vitest` 23.1.0 + `vitest`
   ~4.1.0 + `vite` ^8.0.0 (package.json:24,28-31), plugin wired in nx.json:27-33.

5. **`.nx/cache` + `.nx/workspace-data` live at the worktree root, per-worktree**
   (lines 74-77): CORRECT per .gitignore:41-42. Not inside `node_modules`, so a
   junctioned `node_modules` does not share Nx cache state.

6. **Decision rule** (lines 34-43): SOUND. The three branches (deps-changed ->
   never share; deps-unchanged + independent -> `npm ci` per worktree default, or
   junction; sequentially-dependent -> sequential-on-main) are internally
   consistent and match the RESEARCH.md recommendation. Defaulting to `npm ci`
   over the junction for a small workspace is the correct conservative call.

## Info

### IN-01: `.env` listed under "gitignored paths" is illustrative, not repo-specific

**File:** `AGENTS.md:31`
**Issue:** The doc lists `node_modules`, `.nx/`, `.env` as "gitignored paths"
that are absent. `.env` is not actually in this repo's `.gitignore` (and no
`.env` file exists), and bare `.nx/` is not gitignored either - only its subpaths
(`.nx/cache`, `.nx/workspace-data`, etc.). The operative claim is still correct:
the section leads with the accurate mechanism ("checks out only *tracked*
files"), which makes any untracked OR gitignored path absent regardless of the
`.gitignore` contents. So `.env` and `.nx/` are correct as illustrative examples
of "absent in a fresh worktree," just loosely labeled as "gitignored."
**Fix:** Optional. If precision is wanted, reword to "gitignored or otherwise
untracked paths" - but no change is required; the guidance is correct as written.

---

_Reviewed: 2026-07-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
