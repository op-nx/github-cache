---
phase: 3
slug: cross-context-read
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 3 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` `## Validation Architecture` (27 mapped behaviors, 5 seams).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via `@nx/vitest`), workspace-configured |
| **Config file** | inferred by the Nx plugin; no `project.json` (Phase 1 D-02) |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npx nx run-many -t test typecheck lint` |
| **Estimated runtime** | target < 60s quick run (measure at Wave 0; no watch-mode flags) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test github-cache`
- **After every plan wave:** Run `npx nx run-many -t test typecheck lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds (target)

---

## Per-Task Verification Map

> Task IDs bind after planning (plans not yet created at strategy time). The
> requirement -> behavior -> command mapping below is authoritative and carried
> verbatim from RESEARCH.md; `/gsd:validate-phase` fills the Task ID column
> post-execution.

Status legend (ASCII): `[pending]` `[green]` `[red]` `[flaky]` · File: `[EXISTS]` / `[GAP-W0]`

| Task ID | Requirement | Behavior | Test Type | Automated Command | File | Status |
|---------|-------------|----------|-----------|-------------------|------|--------|
| TBD | CORR-01 | `releaseAssetName(hash, platform)` produces exactly `<hash>-<platform>` (pinned literal) | unit | `npx nx test github-cache -- release-asset-name` | [GAP-W0] | [pending] |
| TBD | CORR-01 | Platform map: `win32->windows`, `darwin->macos`, default (`linux`,`freebsd`)`->linux` | unit | `npx nx test github-cache -- release-asset-name` | [GAP-W0] | [pending] |
| TBD | CORR-01/TEST-05 | Correct-hit: seeded entry for the reader's own platform returns those exact bytes | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | CORR-01/TEST-05 | **Never-wrong-OS (NEGATIVE case): a hash seeded ONLY under the other platform returns MISS, never a hit** | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | TEST-05 | Cross-OS round-trip covers BOTH an OS-invariant and an OS-sensitive hash (D-12) | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | TEST-05 | G1 guard: `.gitattributes` still contains `* text=auto eol=lf` | unit | `npx nx test github-cache -- cross-os-invariants` | [GAP-W0] | [pending] |
| TBD | TEST-05 | G3 guard: backend passes exactly `releaseAssetName(hash)` to the client (recorded arg) | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Tier 1 wins: env token short-circuits, no subprocess spawned | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Tier 1 set-but-EMPTY falls through (`\|\|` not `??`, Pitfall 8) | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Tier 2 wins when env absent: `gh` exit 0 + stdout token | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Tier 2 non-zero exit (`err.code === 1`) falls through to tier 3 | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Tier 2 missing binary (`err.code === 'ENOENT'`, a STRING) falls through to tier 3 | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Tier 3 wins: `password=` parsed from key-value stdout | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Tier 3 declined/empty stdout -> `undefined` (all tiers exhausted) | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | **No-anon guarantee (D-09): every tier exhausted -> `get` MISSes and issues NO unauthenticated request** | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | stderr is never consulted: a tier failing with rich stderr but exit 0 + empty stdout still falls through (stderr is LOCALIZED - measured Danish on this machine) | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | `git credential fill` spawned with `GIT_TERMINAL_PROMPT=0`, askpass neutralized, and a `timeout` (recorded-options assertion) | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Repo identity parses both `https://` and `git@` remote forms, with/without `.git` | unit | `npx nx test github-cache -- local-context` | [GAP-W0] | [pending] |
| TBD | FOUND-02 | Unparseable/absent repo identity -> MISS (never a guessed repo) | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | SRV-05/D-11 | Fault -> MISS for EACH branch: 401, 403, 404, 429, 5xx, thrown network error | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | SRV-05/D-11 | An injected client that THROWS still yields MISS (never propagates) | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | SRV-05/D-11 | Warning emitted at most ONCE per process, and NOT for the ordinary 404-absent path | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | TRUST-05/D-02 | Read-only: `put()` returns `'forbidden'` for every input | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | TRUST-05/D-01 | `selectBackend` local branch returns the Releases reader; `selectBackend.length` stays 0 | unit | `npx nx test github-cache -- select-backend` | [EXISTS] (extend) | [pending] |
| TBD | D-03 | Asset list is PAGINATED (page 2 requested when page 1 returns 100) | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |
| TBD | D-03 | Download carries `Accept: application/octet-stream` + bearer, and does NOT set `redirect:'manual'` | unit | `npx nx test github-cache -- releases-backend` | [GAP-W0] | [pending] |

---

## Test Seams

| Seam | Mechanism | Covers |
|------|-----------|--------|
| Injected fake Releases client (D-04) | Plain object implementing `ReleaseReadClient`, backed by a `Map` | All backend behavior: cross-OS hit/miss, put->forbidden, client-throws->MISS. No mocking framework needed. |
| Injectable platform parameter | `releaseAssetName(hash, platform)` default `process.platform` | All three OS mappings + wrong-OS simulation from a single CI leg. Cannot influence RW/RO, so TRUST-05 holds. |
| Mocked `node:child_process` | `vi.mock('node:child_process')` - precedent `actions-cache-backend.spec.ts:17` | Every auth tier outcome (exit 0 / exit 1 / ENOENT / empty stdout / rich stderr) with no real `gh`, `git`, keychain, or network. |
| Mocked global `fetch` | `vi.spyOn(globalThis, 'fetch')` returning crafted `Response` objects | Full fault matrix by `res.status`, pagination, recorded request headers. |
| Injected `env` bag | Existing convention (`select-backend.ts`, `trust.ts` both take `env` with a default) | Tier-1 cases without mutating `process.env`; `select-backend.spec.ts:102-109` already pins no-mutation. |

---

## Wave 0 Requirements

- [ ] `src/lib/release-asset-name.spec.ts` - covers CORR-01 (pinned literal + platform map, G2/G4)
- [ ] `src/lib/local-context.spec.ts` - covers FOUND-02 (all tier outcomes; mocked `node:child_process`)
- [ ] `src/backend/releases-backend.spec.ts` - covers TEST-05 cross-OS, the D-11 fault matrix, put->forbidden, G3
- [ ] `src/lib/cross-os-invariants.spec.ts` - covers TEST-05 G1 (`.gitattributes eol=lf`); may be folded into `release-asset-name.spec.ts` to avoid a fourth file (planner's call)
- [ ] Extend existing `src/lib/select-backend.spec.ts` - local branch returns the Releases reader, TRUST-05 unchanged
- Framework install: none needed (vitest already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live authenticated private-repo read by a real developer | FOUND-02 | Depends on a real developer's machine auth (gh login / credential helper keychain); cannot be asserted in CI without embedding credentials | With `GH_TOKEN` unset and `gh auth login` completed, run a local Nx build against this repo and confirm a Releases-backed read is attempted with the developer's token |

**Deliberately NOT covered in Phase 3 (deferred per D-12):** the live-GitHub cross-OS CI matrix
round-trip. It requires the Phase 4 publisher to have written real assets, and was already proven
on paper by spike 005 (run 29613149528, all green).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all [GAP-W0] references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] Never-wrong-OS assertion is the NEGATIVE case (a positive-only test passes even with namespacing deleted - CORR-01 would regress silently)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
