---
phase: 04-publish-retention-observability
audited_at: 2026-07-20
auditor: gsd-security-auditor
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
threats_total: 22
threats_closed: 22
threats_open: 0
threats_open_blocking: 0
threats_open_nonblocking: 0
unregistered_flags: 0
status: secured
---

# Phase 04 Security Audit -- Publish + Retention + Observability

Retroactive verification that every mitigation declared in the six PLAN.md
`<threat_model>` blocks is actually present in the implemented code. This is a
CREEP-security-critical phase (CVE-2025-36852 cache-poisoning class): the sync
gate, the fail-loud cleanup list-abort, the first-write-wins mirror, and the
least-privilege scheduled credential are the load-bearing controls.

**Verdict: SECURED.** 22/22 declared mitigations verified present at their cited
trust boundary. `threats_open: 0`. Repo confirmed PUBLIC (`op-nx/github-cache`,
`isPrivate: false`), so the T-04-11 deferral of full TRUST-08 to Phase 5 is
safe. Authoritative signal: `npx nx test github-cache` = 227/227 passing, so the
build-failing content-pins (SYNC_EVENTS deep-equality, @octokit/rest exact-pin,
month-shard boundaries) are live, not merely written.

- **ASVS level:** L1 (opportunistic) -- each declared mitigation verified PRESENT
  at the cited file; high-severity trust-boundary controls traced to the exact
  statement.
- **block_on:** high -- a high or critical OPEN threat would block ship. None open.
- All 22 threats carry disposition `mitigate`. There are no `accept` or `transfer`
  dispositions in this register, so the accepted-risks / transfer-doc logs are
  empty by construction.

## Threat Verification

| Threat ID | Category | Severity | Disposition | Status | Evidence |
|-----------|----------|----------|-------------|--------|----------|
| T-04-01 | Elevation of Privilege | high | mitigate | CLOSED | `sync-gate.ts:49-74` `isSyncTrusted` default-deny: `GITHUB_ACTIONS==='true'` + `SYNC_EVENTS.includes` + `refs/heads/` + `GITHUB_REF_NAME===default_branch`; matrix test-locked `sync-gate.spec.ts` (21 tests green) |
| T-04-02 | Tampering | high | mitigate | CLOSED | `sync-gate.ts:13` `SYNC_EVENTS` is a NEW `as const` decl; `git grep TRUSTED_EVENTS\|isWriteTrusted` in sync-gate.ts = NONE (only import is `node:fs`); content-pin `sync-gate.spec.ts:150` `expect([...SYNC_EVENTS]).toEqual(['push','schedule'])` fails build on widen |
| T-04-03 | Spoofing | medium | mitigate | CLOSED | `sync-gate.ts:67` requires `refs/heads/` prefix AND `sync-gate.ts:22-38` `defaultBranch()` reads `repository.default_branch` from `GITHUB_EVENT_PATH` payload (not `GITHUB_REF_NAME` alone); malformed/absent payload -> undefined -> fail-closed |
| T-04-04 | Denial of Service | medium | mitigate | CLOSED | `retention.ts:48-58` `resolveMaxAgeDays`: `!Number.isFinite(raw)\|\|raw<=0` -> 30; `Math.min(Math.floor(raw),365)`; `retention.spec.ts` boundary cases green |
| T-04-05 | Tampering | high | mitigate | CLOSED | `retention.ts:34-39` `shardTag` is the sole `cache-mirror-${...}` template; `git grep cache-mirror-` in prod = template only in retention.ts (cleanup.ts:92 is a `.startsWith` consumer, not a second template); comment-locked LOAD-BEARING header `retention.ts:1-18` |
| T-04-06 | Information Disclosure | low | mitigate | CLOSED | `releases-backend.ts:159,185,226` thrown messages carry `res.status` only; token interpolated only in `githubJsonHeaders:120-126` + download:213; `releases-backend.ts:204-208` native fetch auto-follows 302 and DROPS Authorization (no `redirect:'manual'`, no re-attach) |
| T-04-07 | DoS / data loss | high | mitigate | CLOSED | `cleanup.ts:86-105` LIST phase materializes ALL `cache-mirror-*` releases+assets into `expired[]` BEFORE the `cleanup.ts:107-129` DELETE phase; any `listAllReleases/listAllAssets` throw propagates (uncaught) -> zero `deleteAsset`; adapter `cleanup/index.ts:32-47` uses `octokit.paginate` (rejects on page fault); mid-pagination-abort test green |
| T-04-08 | Tampering | high | mitigate | CLOSED | `cleanup.ts:44-54` `statusOf` duck-types `error.status` (never `instanceof`, never stderr); `cleanup.ts:116` only 404 = already-gone, every other status -> `failed++` |
| T-04-09 | Denial of Service | medium | mitigate | CLOSED | `cleanup.ts:111-129` per-asset try/catch isolation (`failed++`, `core.warning`); `cleanup.ts:142-144` `if (failed>0) core.setFailed` non-zero exit; per-item-isolation test green |
| T-04-10 | Information Disclosure | low | mitigate | CLOSED | `cleanup.ts:125-127` `core.warning` carries only `asset.name` + `statusOf`; `cleanup.ts:131-139` summary table = counts only; no token/credential/raw-command echo |
| T-04-11 | Information Disclosure | high | mitigate | CLOSED | `publish-mirror.ts:22` `CACHE_KEY_PREFIX='nx-cache-'`, filter `publish-mirror.ts:165` `startsWith` + slice; only server-produced keys mirrored. Full single-source TRUST-08 parity deferred to Phase 5 (D-16/C16) -- SAFE: repo confirmed PUBLIC (assets already world-readable) |
| T-04-12 | Tampering | high | mitigate | CLOSED | `publish-mirror.ts:217` pre-list `existingNames.has(name)` -> benign skip (no overwrite); `publish-mirror.ts:228` upload 422 (post-pre-list race) -> benign skip; first-write-wins tests green |
| T-04-13 | Tampering | high | mitigate | CLOSED | `publish-mirror.ts:81-91` `statusOf`; `ensureShardRelease:100-127` only 404=not-created, 422-on-create -> re-read, else throw; upload 422 benign ONLY on the pre-listed path (name confirmed absent before upload), else surfaced (`publish-mirror.ts:240-243`) |
| T-04-14 | Denial of Service | medium | mitigate | CLOSED | `publish-mirror.ts:190-198` `bytes.byteLength>=RELEASE_ASSET_MAX_BYTES` (`2*1024^3`) -> `core.error`+throw BEFORE any upload (never truncate); `publish-mirror.ts:206-213` 1000-cap -> `core.warning`+skip, no throw/setFailed |
| T-04-15 | Elevation of Privilege | high | mitigate | CLOSED | `cleanup.yml:18-19` `permissions: contents: write` ONLY (no `actions:read`, no `delete:packages`, no PAT); `cleanup.yml:40-44` `GITHUB_TOKEN` by inheritance; bin `cleanup/index.ts:79-89` `resolveGitHubToken(GH_TOKEN\|\|GITHUB_TOKEN)` + `new Octokit({auth:token})` |
| T-04-16 | DoS / data loss | high | mitigate | CLOSED | `cleanup.yml:11-12` single daily `schedule` cron; `cleanup.yml:25-27` `concurrency: {group, cancel-in-progress: false}` (queue, never cancel mid-delete); not a ci.yml job, no OS matrix |
| T-04-SC | Tampering (supply chain) | high | mitigate | CLOSED | `package.json:21` `"@octokit/rest": "22.0.1"` bare exact-pin; `pinned-deps.spec.ts:39-43` `toMatch(/^\d+\.\d+\.\d+$/)` range guard green; audited OK (official octokit org, no postinstall) |
| T-04-17 | Information Disclosure | low | mitigate | CLOSED | `cleanup/index.ts:79` token via `resolveGitHubToken` env inheritance, never interpolated into summaries; `local-context.ts:85-87` no stderr listener (structural-only); WR-03 `local-context.ts:64` `killSignal:'SIGKILL'` uncatchable timeout |
| T-04-18 | Elevation of Privilege | high | mitigate | CLOSED | `action/index.ts:122-128` `runPublish` FIRST statement is `if (!isSyncTrusted(process.env)) { core.info; return; }` (exit 0, not error); uses `isSyncTrusted` NOT `isWriteTrusted`; `ci.yml:181` `if: !cancelled() && push` as defense-in-depth |
| T-04-19 | Denial of Service | medium | mitigate | CLOSED | `ci.yml:202-204` publish job-level `permissions: {contents: write, actions: read}` restates BOTH scopes (a job block replaces the workflow `contents:read` wholesale; omitting `actions:read` 404s `getActionsCacheList`) |
| T-04-20 | Tampering | medium | mitigate | CLOSED | `ci.yml:183-196` `fail-fast: false` matrix `[ubuntu-24.04-arm, windows-11-arm]`, each leg mirrors own-OS; `ci.yml:182` `needs: build` (NOT test); `ci.yml:194` `max-parallel: 1` (WR-01 cap-race fix) |
| T-04-21 | Information Disclosure | low | mitigate | CLOSED | `action/index.ts:141` token by `resolveGitHubToken` inheritance; `action/index.ts:160-168` summary = mirrored/skipped/failed counts only, never the token |

## Unregistered Flags

None. No SUMMARY (`04-01`..`04-06`) contains a `## Threat Flags` section, and no
new attack surface appeared during implementation that lacks a register mapping.
The publish/cleanup/read-back entry points, the `@octokit/rest` dependency, and
the `CACHE_MIRROR_MAX_AGE_DAYS` knob are all covered by the plan-authored register
(T-04-11/12/13/14, T-04-SC, T-04-04 respectively).

## severity-aware threats_open computation

`block_on: high` -> blocking rank = {high, critical}. Open threats: 0.
Blocking-open: 0. Non-blocking-open: 0. `threats_open` frontmatter gate = **0**.
No open threat carries an unparseable severity (fail-closed rule not triggered).

## Notes on complex dispositions (verified, not soft-passed)

- **T-04-13 (422 discrimination on status, not body):** the engine treats an
  upload-time 422 as a benign already-exists on status alone (`publish-mirror.ts:228`,
  no body `already_exists` parse). This satisfies the disposition's "benign only
  when already_exists / pre-listed" clause via the *pre-listed* arm: the upload is
  only reached after `existingNames.has(name)` confirmed the name was ABSENT
  (`publish-mirror.ts:217`), so a subsequent 422 can only be a concurrent-leg race
  that made it present -- the exact already-exists case. Not a gap.
- **T-04-07 list-abort is by propagation, not a caught-and-checked branch:** the
  LIST phase deliberately does NOT wrap `listAll*` in try/catch, inverting the
  reader's swallow-to-MISS discipline (`cleanup.ts:60-70`). Verified this is the
  intended fail-loud mechanism and that no `deleteAsset` call is reachable before
  the LIST phase completes.

## Residual risk observations (out of register scope, non-blocking, informational)

These are the 5 Info-severity code-review findings (`04-REVIEW-FIX.md:51-58`),
carried forward for a future maintainer. They are NOT threats in the plan-authored
register and do NOT count toward `threats_open`. None undermines a declared
mitigation above.

- **IN-01:** `GITHUB_REPOSITORY_PATTERN` accepts any non-slash chars (looser than
  GitHub's identifier grammar). Does not weaken T-04-15/16 -- credential scope is
  enforced by the workflow `permissions` block, not the pattern; the pattern still
  fail-closes on a missing `/`.
- **IN-02:** `cleanupMirror` prunes assets but never deletes now-empty month-shard
  Release objects. Storage-tidiness only; not a security boundary.
- **IN-03:** `shardTagsForWindow` has no self-validation, relying on callers to
  pre-clamp via `resolveMaxAgeDays`. Verified every production caller
  (`releases-backend.ts:296`, publish via `resolveMaxAgeDays`) routes through the
  T-04-04 clamp, so the DoS mitigation holds at the boundary.
- **IN-04:** publish Actions-cache restore is not per-item isolated the way uploads
  are; a restore fault throws whole-run (fail-loud) rather than per-item skip.
  Acceptable -- fail-loud is the safe direction.
- **IN-05:** `GITHUB_API` hardcoded to `https://api.github.com` (no GHES). Scope
  limitation, not a vulnerability.

## Accepted Risks Log

None. Every threat in this register carries disposition `mitigate` and every
mitigation is verified present. No risks were accepted and no threats were
transferred.
