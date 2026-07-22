---
phase: 260721-eac
plan: 01
subsystem: github-cache
status: complete
tags: [tech-debt, cleanup, requirements, TRUST-04, TRUST-07]
requires: []
provides:
  - "trust.ts as the sole isWriteTrusted source (dual-root drift surface removed)"
  - "TRUST-07 requirement reconciled with 04-VERIFICATION.md"
affects:
  - .github/workflows/ci.yml
  - package.json
  - .fallowrc.jsonc
  - .prettierignore
  - packages/github-cache/pack-check.cjs
  - .planning/REQUIREMENTS.md
tech-stack:
  added: []
  patterns:
    - "single-source-of-truth allowlist (trust.ts) with no generated copy to drift against"
key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - package.json
    - .fallowrc.jsonc
    - .prettierignore
    - packages/github-cache/pack-check.cjs
    - .planning/REQUIREMENTS.md
  deleted:
    - packages/github-cache/src/action/trust.generated.cjs
    - packages/github-cache/selfcheck.cjs
    - packages/github-cache/src/lib/trust.generated.spec.ts
    - packages/github-cache/src/selfcheck.spec.ts
decisions:
  - "A1: REMOVE the whole trust.generated write-trust loop (zero runtime consumers; both actions reach the write gate via trust.ts). trust.ts kept as single source."
  - "A2: flip TRUST-07 checkbox to [x]; leave TRUST-07-GHCR (later-milestone) parked."
metrics:
  duration_min: 3
  tasks: 2
  files_changed: 10
  completed: 2026-07-21
---

# Quick Task 260721-eac: Address A1 and A2 in this branch - Summary

Removed the orphaned `trust.generated.cjs` write-trust loop (4 files deleted + 5 config/guard files de-referenced) so `trust.ts` is the sole `isWriteTrusted` source, and flipped the stale TRUST-07 requirement checkbox to `[x]` - full CI battery green, no deps/lockfile change.

## What Was Done

### Task 1 (A1) - remove the trust.generated write-trust loop (TRUST-04)
Commit: `70213b0`

STEP 0 confirmation gate (security-adjacent removal) ran BEFORE any deletion:
- `git grep -n "trust.generated" -- ':!*trust.generated.cjs' ':!*trust.generated.spec.ts' ':!.planning/*'` returned hits ONLY in files this task removes/edits: `.fallowrc.jsonc`, `.github/workflows/ci.yml`, `.prettierignore`, `packages/github-cache/selfcheck.cjs`, `packages/github-cache/src/selfcheck.spec.ts`. No other runtime consumer surfaced.
- The production-importer grep (`require(.*trust.generated|from.*trust.generated` over `src/**/*.ts` and `src/**/*.cjs`) returned EMPTY - zero production `require()`/`import` of the deleted copy. Gate passed; no abort.

Deleted via `git rm`:
- `packages/github-cache/src/action/trust.generated.cjs` (orphaned artifact)
- `packages/github-cache/selfcheck.cjs` (generator/drift-detector)
- `packages/github-cache/src/lib/trust.generated.spec.ts` (147-case parity spec)
- `packages/github-cache/src/selfcheck.spec.ts` (CLI drift-detection test)

Edited:
- `.github/workflows/ci.yml`: removed the entire `selfcheck` job + its leading comment block; one blank line now separates the `fallow` job from the `action-bundle-drift` comment. No `needs: selfcheck` existed anywhere, so no downstream `needs:` edits were required.
- `package.json`: removed ONLY the `selfcheck` and `generate:trust` script lines. Dependencies/devDependencies untouched; `package-lock.json` unmodified.
- `.fallowrc.jsonc`: removed BOTH blocks - the `selfcheck.cjs` `entry` and the `trust.generated.cjs` `ignorePatterns` (each with its comment).
- `.prettierignore`: removed the `trust.generated.cjs` block (comment + path), leaving a single blank separator between the vendored-OpenAPI and esbuild-bundle blocks.
- `packages/github-cache/pack-check.cjs`: removed the dead `FORBIDDEN` `selfcheck.cjs` predicate and dropped the two stale doc-comment mentions. Guard logic otherwise unchanged.

### Task 2 (A2) - flip the TRUST-07 checkbox (TRUST-07)
Commit: `f9c426c`

`.planning/REQUIREMENTS.md` line 54: `- [ ] **TRUST-07**` -> `- [x] **TRUST-07**`. Single-character change on a single line. Line 87's `TRUST-07-GHCR` (later-milestone GHCR-01 bullet) left untouched. `git grep -c "\- \[ \] \*\*TRUST-07\*\*"` returns 0 (no unchecked TRUST-07 remains).

## Verify Battery Results

| Command | Result |
|---------|--------|
| `npx nx test github-cache` | PASS - 330 tests, 26 files (the two removed specs no longer referenced; no missing-import failures) |
| `npm run check:action` | PASS - exit 0 (esbuild bundle byte-matches committed `start-cache-server/index.js`) |
| `npm run fallow:ci` | PASS - 0 issues, 40 entry points (down from 41; the `selfcheck.cjs` manual entry removed cleanly, no dangling entry/ignore) |
| `npm run pack:check` | PASS - tarball ships 76 files (dist/ + LICENSE + README.md + package.json only; no internals leaked) |

Additional proofs:
- `git diff -- package.json` shows ONLY the two removed script lines (no deps change).
- `git status --porcelain -- package-lock.json` empty (lockfile unmodified - Windows lockfile-prune trap avoided).
- `git status --porcelain -- packages/github-cache/src/lib/trust.ts` empty (single source unchanged).
- `git grep -c "export function isWriteTrusted" -- 'packages/github-cache/src/**/*.ts'` = 1 (trust.ts only).
- `git grep -n "trust.generated"` returns hits ONLY under `.planning/` (docs) - zero in source/config.

## Deviations from Plan

None - plan executed exactly as written. The two planning-discovered extra references (`.prettierignore` dangling ignore, `pack-check.cjs` dead predicate) were already folded into Task 1 by the plan, and the `.fallowrc.jsonc` second block (the `selfcheck.cjs` entry) was likewise pre-identified; all removed as specified.

## Self-Check: PASSED

- Deleted files confirmed absent: `trust.generated.cjs`, `selfcheck.cjs`, `trust.generated.spec.ts`, `src/selfcheck.spec.ts` (git rm recorded 4 deletions in commit 70213b0).
- Commits confirmed in history: `70213b0` (Task 1), `f9c426c` (Task 2).
- `packages/github-cache/src/lib/trust.ts` unmodified (single source of truth preserved).
