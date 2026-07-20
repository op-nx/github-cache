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
