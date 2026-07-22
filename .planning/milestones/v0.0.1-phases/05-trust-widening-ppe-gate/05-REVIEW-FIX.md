---
phase: 05-trust-widening-ppe-gate
fixed_at: 2026-07-20T21:05:00Z
review_path: .planning/phases/05-trust-widening-ppe-gate/05-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-07-20T21:05:00Z
**Source review:** .planning/phases/05-trust-widening-ppe-gate/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Critical + Warning; 0 Critical, 3 Warning)
- Fixed: 3
- Skipped: 0
- Info findings (IN-01, IN-02): out of scope (critical_warning), not attempted.

All fixes are documentation/config hardening (no source-logic changes), so
no finding required human logic verification. Full gate battery re-run green
after all three commits (see Verification below).

## Fixed Issues

### WR-02: PPE gate's actionlint installer fetches an unpinned script from `main`

**Files modified:** `ppe/action.yml`
**Commit:** 44c9a46
**Applied fix:** Changed the `download-actionlint.bash` fetch URL from the
mutable `.../actionlint/main/scripts/...` ref to the pinned tag
`.../actionlint/v1.7.12/scripts/...`, matching the already-pinned binary
version argument (`1.7.12`). This pins the SCRIPT itself, closing the
curl-pipe-bash supply-chain window for consumers embedding this composite
action in credentialed jobs. The pinned-tag URL was verified to resolve
(HTTP 200) before shipping, so no checksum-verification fallback was needed.

### WR-03: zizmor step interpolates `${{ inputs.path }}` directly into a shell `run:` step

**Files modified:** `ppe/action.yml`
**Commit:** 3dd4e36
**Applied fix:** Routed `${{ inputs.path }}` through an `AUDIT_PATH` env var
on BOTH advisory audit steps (zizmor and actionlint), and referenced the
quoted `"$AUDIT_PATH"` in each `run:` script instead of interpolating the
expression directly. This removes the template-injection shape (the exact
pattern this action scans for in other workflows). Both steps remain advisory
(`zizmor --no-exit-codes`; actionlint exit swallowed with `|| true`) and keep
their per-step `shell: bash`. Added a short comment on each step explaining
the env routing.

### WR-01: `selfcheck.cjs`'s "byte-diffs on ANY drift" claim overstates its actual coverage

**Files modified:** `packages/github-cache/selfcheck.cjs`, `.github/workflows/ci.yml`
**Commit:** 293546f
**Applied fix:** Chose fix option (b) — the accurate-comments fix — over the
deeper AST/regex-derived-body fix, per guidance (lower risk, sufficient).
Corrected the overclaiming comments in the `selfcheck.cjs` header and the
`ci.yml` selfcheck job comment to state precisely that the byte diff guards
the two extracted ALLOWLIST ARRAYS (`TRUSTED_EVENTS` / `HOST_GATED_EVENTS`)
plus hand-edit detection of the committed `.cjs`, and that host-gate LOGIC
parity between `trust.ts` and the generated `.cjs` is guarded by the
`src/lib/trust.generated.spec.ts` semantic-parity suite (cited by name in both
comments), NOT by this byte diff. Removed the "ANY drift ... or a trust.ts
change with no regeneration" claim. No generated output changed, so selfcheck
still reports "in sync".

Note: The `trust.generated.spec.ts` `SERVER_URL_VALUES` matrix gap
(`https://notghe.com` / bare `https://ghe.com`) called out in WR-01's
secondary suggestion and in IN-02 was NOT addressed — it is a test-coverage
enhancement tracked as Info-tier finding IN-02 (out of scope for this
critical_warning fix pass), not part of the comment-accuracy fix chosen.

## Verification

Full gate battery re-run after all three commits, all green:

- `node packages/github-cache/selfcheck.cjs` -> exit 0 ("in sync")
- `npx nx format:check --all` -> exit 0
- `npx nx run-many -t test typecheck build -p github-cache` -> exit 0
  (test 424/424 passed, typecheck clean, build clean)
- `npm run fallow:ci` -> exit 0 (0 issues, 32 entry points)

Per-fix verification: Tier 1 (re-read modified sections) for all; Tier 2
syntax/parse checks for `action.yml` (YAML parse OK, 4 steps), `ci.yml`
(YAML parse OK, 12 jobs), and `selfcheck.cjs` (`node -c` OK).

---

_Fixed: 2026-07-20T21:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
