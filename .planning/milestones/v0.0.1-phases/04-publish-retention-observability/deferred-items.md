# Phase 4 - Deferred / Out-of-Scope Items

Discoveries logged during execution that are out of scope for the plan in hand
(deviation SCOPE BOUNDARY: only issues directly caused by the current task are auto-fixed).

| Category | Item | Evidence | Status | Found during |
|----------|------|----------|--------|--------------|
| Build gate | `fallow:ci` (blocking CI dead-code gate) exits non-zero on ONE circular dependency: `releases-backend.ts -> local-context.ts -> select-backend.ts -> releases-backend.ts`. PRE-EXISTING, not introduced by 04-02. | Confirmed empirically: fallow:ci was already RED at `34a2f70` (pre-04-02) with the identical finding. Cycle edge `select-backend -> releases-backend` was introduced in `41d0445` (03-03) and documented in STATE as a "benign call-time-only circular import". All three edges predate 04-02; 04-02's new module `retention.ts` has zero imports and is not in the cycle. | OPEN - defer to a dedicated structural task | 04-02 Task 2 (fallow:ci verification) |

## Notes on the fallow circular dependency

- Breaking the cycle is a Rule 4 architectural change touching `select-backend.ts` /
  `local-context.ts` (move the shared `GITHUB_REPOSITORY_PATTERN` + `resolveGitHubToken`
  to a neutral module so `local-context` no longer imports `select-backend`). That is out
  of scope for a retention-window plan and risks the Phase 3 auth/identity core.
- 04-02's own additions (`retention.ts`, `fetchAssetFromShard`) are fallow-clean; the gate
  reports no dead code or unreachable exports for this plan's work.

## 04-06: pre-existing Prettier drift in prior-plan files

**Found during:** 04-06 Task 3 (format:check gate check)

`npx nx format:check --all` (the `format-check` CI job) is RED because several files
committed by EARLIER plans in this phase are not Prettier-clean. None were touched by
04-06; each is out of 04-06's scope:

| File | Committed by |
|------|--------------|
| `packages/github-cache/src/lib/sync-gate.ts` | 6c84d9c feat(04-01) |
| `packages/github-cache/src/lib/sync-gate.spec.ts` | 0e451dd test(04-01) |
| `packages/github-cache/src/lib/retention.ts` | 8c3d69c feat(04-02) |
| `packages/github-cache/src/lib/retention.spec.ts` | 6a68b1f test(04-02) |
| `packages/github-cache/src/publish/publish-mirror.ts` | e16517c feat(04-04) |

**Impact:** the `format-check` CI job fails until these are reformatted
(`npx nx format:write --all`). Does NOT affect `test`/`typecheck`/`build` (all green).

**Recommendation:** a dedicated `/gsd:fast` formatting pass over these prior-plan files
(alongside the pre-existing Phase 3 fallow import-cycle task already queued for `/gsd:fast`).
04-06's own files (action/index.ts, roundtrip/read-back.ts, ci.yml, .fallowrc.jsonc) are
Prettier-clean.
