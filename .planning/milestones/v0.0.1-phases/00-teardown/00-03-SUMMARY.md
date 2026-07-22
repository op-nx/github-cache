---
phase: 00-teardown
plan: 03
subsystem: infra
tags: [prettier, prettierignore, nx-format, readme, ci, de-priming]

# Dependency graph
requires:
  - phase: 00-teardown (plans 00-01, 00-02)
    provides: shell-only Nx workspace + reworked local-cache-only CI (format:check --all is a live gate)
provides:
  - ".prettierignore scopes nx format:check --all to real workspace source (agent + planning docs + migration backup ignored)"
  - "green nx format:check --all gate that survives future .planning churn (incl. SC5 map-codebase writes)"
  - "root README.md trimmed to a neutral workspace-shell placeholder (no deleted-PoC references, no dead links)"
affects: [phase-0-map-codebase-de-priming, phase-6-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Format gate scoped to source: .prettierignore excludes churny agent/planning docs so nx format:check --all stays green as those docs change"

key-files:
  created: []
  modified:
    - .prettierignore
    - README.md

key-decisions:
  - "D-07: added .planning/, CLAUDE.md, AGENTS.md, .claude/ to .prettierignore; kept all existing entries; no repo-wide reformat"
  - "D-08: rewrote README.md to name + greenfield-rebuild note + generic build/test line only; removed op-nx-github-cache 'only package' prose and the broken package-README link"
  - "Deviation (Rule 3): also ignored .gsd-migration-backup/ - a gitignored, untracked migration artifact that nx format:check --all scanned locally and that blocked the exit-0 acceptance"

patterns-established:
  - "Keep the prettier gate on real workspace source; add non-source doc/artifact trees to .prettierignore rather than reformatting them"

requirements-completed: []

coverage:
  - id: D1
    description: ".prettierignore contains the four D-07 entries (.planning/, CLAUDE.md, AGENTS.md, .claude/) plus all pre-existing entries, and nx format:check --all exits 0"
    verification:
      - kind: other
        ref: "git grep -F on '.planning/','CLAUDE.md','AGENTS.md','.claude/','/.nx/cache' -- .prettierignore (all match) + npx nx format:check --all (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "README.md is a neutral shell: no 'op-nx-github-cache', no packages/op-nx-github-cache/README.md link, no 'the only package' claim; non-empty and mentions @op-nx/source"
    verification:
      - kind: other
        ref: "git grep -F 'op-nx-github-cache'/'packages/op-nx-github-cache/README.md'/'the only package' -- README.md (no match, exit 1) + git grep -F '@op-nx/source' -- README.md (match)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-07-18
status: complete
---

# Phase 0 Plan 03: De-prime the stale docs Summary

**Scoped nx format:check --all to real workspace source via .prettierignore (agent, planning, and migration-backup docs ignored) and trimmed the root README.md to a neutral greenfield-rebuild shell with no deleted-PoC references or dead links.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-18T02:32:32Z
- **Completed:** 2026-07-18T02:38:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `.planning/`, `CLAUDE.md`, `AGENTS.md`, `.claude/` to `.prettierignore` (D-07) while keeping every pre-existing entry (`/dist`, `/coverage`, `/.nx/cache`, `/.nx/workspace-data`, `.nx/self-healing`). No repo-wide `nx format:write` - the gate is scoped to source, not the docs reformatted.
- Made `npx nx format:check --all` exit 0 (the format half of SC3), and confirmed it stays green after the README rewrite (README is NOT ignored, so it is still format-checked).
- Rewrote `README.md` (D-08) to a neutral placeholder: workspace name `@op-nx/source`, a one-line greenfield-rebuild note, and the generic `npx nx run-many -t build test` line. Removed the "only package" claim, all PoC prose, and the broken `packages/op-nx-github-cache/README.md` link (the README half of SC5).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add agent + planning docs to .prettierignore** - `e45ea4e` (chore)
2. **Task 2: Rewrite README.md as a neutral workspace-shell placeholder** - `926cbdf` (docs)

## Files Created/Modified
- `.prettierignore` - Added the four D-07 doc entries plus `.gsd-migration-backup/`; kept all five existing entries. Scopes the format gate to real workspace source.
- `README.md` - Trimmed from a PoC-describing README (17 lines removed) to an 8-line neutral workspace shell.

## Decisions Made
- Followed D-07 and D-08 as specified. For D-08 I kept only the three items the plan enumerated (name, rebuild note, build/test line) and dropped the old `## License MIT` section, since the plan's "keep only" list did not include it and it carried no PoC reference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ignored .gsd-migration-backup/ so format:check --all exits 0**
- **Found during:** Task 1 (verification step)
- **Issue:** After adding the four D-07 entries, `npx nx format:check --all` still exited 1 on `.gsd-migration-backup/2026-07-17.../MANIFEST.json` - an unformatted file inside a gitignored, untracked GSD1->OpenGSD migration backup directory (0 tracked files). The plan's acceptance criterion (`format:check --all -> exit 0`) could not be met while nx/prettier scanned it.
- **Fix:** Added `.gsd-migration-backup/` to `.prettierignore`. Same category as D-07 (churny, not workspace source, dogfood-safe). The directory is gitignored so it never ships and would not exist in CI's fresh checkout - this only affects the local gate.
- **Files modified:** `.prettierignore`
- **Verification:** `npx nx format:check --all` -> exit 0.
- **Committed in:** `e45ea4e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy the plan's own `format:check --all -> exit 0` acceptance criterion. Aligned with D-07's intent (keep the gate on real source); no consumer-contract file ignored, no scope creep beyond doc/artifact trees.

## Issues Encountered
- None beyond the blocking issue documented above. Both tasks' grep batteries passed on the first attempt; the file already had LF endings and the rewritten README is ASCII-only and prettier-clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The format half of SC3 (green `format:check --all`) and the README half of SC5 (no rebuild-priming artifact in the root README) are met.
- The scoped `.prettierignore` means SC5's `/gsd:map-codebase` run (later in this phase, D-06) can write more `.planning` markdown without re-reddening the format gate.

## Self-Check: PASSED

- Files: `.prettierignore` and `README.md` confirmed present with the required content.
- Commits: `e45ea4e` and `926cbdf` both found in `git log`.
- Acceptance: Task 1 entry greps all match, Task 2 forbidden-string greps all return exit 1, `@op-nx/source` present, and `npx nx format:check --all` exits 0.

---
*Phase: 00-teardown*
*Completed: 2026-07-18*
