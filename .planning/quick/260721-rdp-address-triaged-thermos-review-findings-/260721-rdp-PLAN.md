---
quick_id: 260721-rdp
title: Address triaged thermos review findings on PR #3
status: planned
mode: quick-full (research skipped; executed inline on current branch, worktrees disabled)
branch: gsd/v0.0.1-greenfield-rebuild
created: 2026-07-21
must_haves:
  truths:
    - The PPE composite action never hard-fails a consumer job on a tool INSTALL failure (advisory-contract honored end to end, not just for findings).
    - The consumer env-knob contract list exists in exactly one place shared by both guard specs.
    - No comment in shipped source makes a false claim (no fictional "backward-compatible/historical" rationale on a first release).
    - The full-body in-memory PUT buffering ceiling is documented as a deliberate simplification with its upgrade path.
  artifacts:
    - ppe/action.yml (non-fatal installs + binary-guarded zizmor audit)
    - packages/github-cache/src/ppe/ppe-action.spec.ts (assertions locking the non-fatal-install contract)
    - packages/github-cache/src/test/consumer-contract.ts (shared EXPECTED_ENV_KNOBS)
    - packages/github-cache/src/public-surface.spec.ts (imports shared constant; keeps inline pin)
    - packages/github-cache/src/docs-adoption.spec.ts (imports shared constant)
    - packages/github-cache/src/backend/types.ts (honest CacheBackend alias comment)
    - packages/github-cache/src/server/server.ts (ponytail: PUT buffering ceiling note)
  key_links:
    - packages/github-cache/src/ppe/ppe-action.spec.ts
    - packages/github-cache/src/public-surface.spec.ts
---

# Quick Task 260721-rdp: Address triaged thermos review findings (PR #3)

Source: dual thermo-nuclear review of PR #3. No Critical/High findings; 341 tests
pass. Four findings survived triage (M1 defect + Q5/Q3/L3 polish). Deferred/rejected:
Q1/Q2 (plan-ID comment taxonomy churn), Q4 (isEntrypoint dedup), Q6 (keep the `never`
exhaustiveness guard), Q7 (keep passing doc-topic guards), L2 (schedule-sync coverage).

Bisect-safe atomic commits, one logical fix each, on the current branch. After each
commit: `nx test github-cache` stays green. Bundled-source edits (Q3/L3) verified
against the committed action bundle with `npm run check:action`.

## Task 1 [M1]: PPE advisory-install non-fatal guards (fix + spec lock)
- files: ppe/action.yml, packages/github-cache/src/ppe/ppe-action.spec.ts
- action: `pipx install zizmor==1.27.0` and the actionlint `bash <(curl ...)` install
  each get a non-fatal `|| echo "::warning::..."` fallback; the zizmor audit step gets a
  `command -v zizmor >/dev/null 2>&1 || { warn; exit 0; }` guard so a failed install
  degrades to skip, never a hard fail. actionlint audit already ends `|| true` (leave).
  Add spec assertions: `/pipx install zizmor==1\.27\.0 \|\|/`, an actionlint-install
  non-fatal fallback token, and `/command -v zizmor/`.
- verify: `nx test github-cache` (ppe-action.spec passes); ppe CI job stays green (ubuntu
  has pipx preinstalled, so the happy path is unchanged — findings still surface as annotations).
- done: install failures can no longer fail a consumer's job; contract is test-locked.

## Task 2 [Q5]: Hoist EXPECTED_ENV_KNOBS to one shared test constant
- files: packages/github-cache/src/test/consumer-contract.ts (new),
  packages/github-cache/src/public-surface.spec.ts, packages/github-cache/src/docs-adoption.spec.ts
- action: extract the duplicated 7-element array into the shared module; both specs import it.
  public-surface.spec keeps its inline sorted-literal self-check as the human-reviewable pin.
- verify: `nx test github-cache` green; fallow dead-code stays clean (spec-imported helper is reachable).
- done: adding/removing a knob updates both guards from one edit.

## Task 3 [Q3]: Correct the CacheBackend alias comment (comment-only)
- files: packages/github-cache/src/backend/types.ts
- action: replace the false "Backward-compatible alias ... historical public name" claim with an
  honest description of the ergonomic read-write alias. Keep the alias (documented public export).
- verify: `nx test`, `nx typecheck` green; `npm run check:action` (bundle unchanged — type/comment only).
- done: no false rationale in shipped source.

## Task 4 [L3]: ponytail note on full-body PUT buffering ceiling (comment-only)
- files: packages/github-cache/src/server/server.ts
- action: add a `ponytail:` comment at handlePut naming the N x 2 GiB concurrent-PUT ceiling
  (fine for the single-tenant loopback sidecar) and the stream-to-temp upgrade path.
- verify: `nx test`, `nx typecheck` green; `npm run check:action` (bundle unchanged — comment only).
- done: the deliberate simplification is documented with its ceiling and upgrade path.
