---
phase: 4
phase_name: "Publish + Retention + Observability"
project: "@op-nx/github-cache"
generated: "2026-07-20"
counts:
  decisions: 6
  lessons: 5
  patterns: 5
  surprises: 3
missing_artifacts: []
---

# Phase 4 Learnings: Publish + Retention + Observability

## Decisions

### Retention default = 30 days, one coupled knob
`CACHE_MIRROR_MAX_AGE_DAYS` defaults to 30 and drives BOTH the cleanup window and the reader's `shardTagsForWindow` month-shard lookback. Chosen against researched prior art, not a guess.

**Rationale:** CircleCI's cache (15-day cap) is the closest analog on BOTH clock (creation, like Release assets which expose no last-accessed field) and purpose (a cache, not a downloadable artifact) — so 30 (2x it, 4x the 7-day access-clock caches to compensate for the harsher creation clock) beats the GH-Actions-artifacts 90-day analog. 30 also matches the monthly shard quantum 1:1, so a MISS walks only 1-2 shards. Free/uncapped Releases storage means the vendor numbers are all biased low relative to this project.
**Source:** 04-CONTEXT.md D-07; retention prior-art research

### Octokit for publish + cleanup; reader stays on native fetch (deliberate asymmetry)
Publish and cleanup discriminate faults structurally on Octokit `error.status`; the Phase 3 reader keeps native `fetch` + `res.status`.

**Rationale:** the reader is on the zero-dep serve path; the publisher/cleanup are bins running after `npm ci` where a dependency is already normal. ROBUST-01/SC2/ADR C12 name Octokit. Do not retrofit the reader.
**Source:** 04-CONTEXT.md D-04

### Per-OS publish matrix is mandatory, not an optimization
The publish job is a `[ubuntu-24.04-arm, windows-11-arm]` matrix; each leg mirrors only entries it can restore on its own OS.

**Rationale:** `@actions/cache` `getCacheVersion` folds the OS tmpdir path + a windows-only salt + compression method into the version hash, so an ubuntu job can NEVER restore a Windows-saved entry (silent skip). Collapsing to one OS silently drops the other OS's entries.
**Source:** 04-CONTEXT.md D-03; releases-backend memory

### Sync gate is a SEPARATE predicate from the write gate
`isSyncTrusted` ({push,schedule}+default-branch) is its own declaration; it must never import `TRUSTED_EVENTS`/`isWriteTrusted` from trust.ts.

**Rationale:** the two event sets coincide today, but Phase 5/TRUST-01 widens the WRITE allowlist to pull_request/release — a shared predicate would silently widen SYNC too, recreating the CREEP precondition.
**Source:** 04-CONTEXT.md D-01; ADR C2

### github-identity.ts leaf module to break the import cycle
`GITHUB_REPOSITORY_PATTERN` + `resolveGitHubToken` were extracted from select-backend.ts into a leaf module; select-backend re-exports them; local-context imports from the leaf.

**Rationale:** removes the local-context -> select-backend back-edge that closed the pre-existing releases-backend -> local-context -> select-backend cycle. Re-export keeps TEST-01's `from './select-backend.js'` byte-identical. Pure module-boundary move.
**Source:** /gsd:fast --validate (commit d10f8fd)

### WR-02 aggregate fail-loud placed in the engine, not the bin
`publishMirror` calls `core.setFailed` when `failed > 0`, mirroring `cleanupMirror`, rather than the action/index.ts bin doing it.

**Rationale:** action/index.ts auto-runs `run()` on import and does not export `runPublish`, so the engine is the clean, testable seam; symmetric with cleanup.
**Source:** 04-REVIEW-FIX.md (WR-02, commit 5697abb)

---

## Lessons

### A green LOCAL `npm ci` cannot catch cross-OS lockfile drift
Adding `@octokit/rest` via `npm install --save-exact` on the Windows arm64 host pruned the Linux-side WASM-fallback optional deps (`@emnapi/core`/`runtime` @ 1.11.1/1.11.2, nested under the oxc/rolldown wasm32-wasi bindings). Every CI job then failed at the shared `npm ci` first step, while local `npm ci` stayed green because the lockfile matched the host platform.

**Context:** first push to main (CI run 29726381233) went red on ALL jobs. Fix: regenerate package-lock.json from a clean full resolve in a `linux/arm64 node:24` container with node_modules masked (anonymous volume) so the host tree can't bias it (commit 7fec51e). Exact recurrence of quick task 260719-in3 — dep-adding on Windows must be followed by the container regen.
**Source:** CI run 29726381233 failure; fix commit 7fec51e

### A live-CI-only proof is correctly resolved by an actual push, not unit proof
The verifier returned `human_needed` for the cross-OS mirror->read-back round-trip (it only runs against real GitHub services on a default-branch push). Every sub-component was unit-proven, but the end-to-end wire-up needed CI run 29726834220 (both publish + publish-verify legs green) to close.

**Context:** the phase scoped this leg as its "first-real-push closing proof"; deferred from Phase 3.
**Source:** 04-VERIFICATION.md

### Duplicate release asset returns HTTP 422, not 409
Settled the plan's 422-vs-409 hedge for first-write-wins (TRUST-07): a duplicate asset name is a 422 `already_exists`, treated as a benign no-op only on the pre-listed arm.

**Context:** researched against Octokit/GitHub REST docs before implementation.
**Source:** 04-RESEARCH.md; 04-04-SUMMARY.md

### `octokit.paginate` rejects the whole call on any page fault
This is the RETAIN-01/C9 list-abort guarantee for free: materialize the complete asset set with `octokit.paginate` first, then delete — never the streaming iterator. Any page fault aborts with zero deletions.

**Context:** the load-bearing cleanup-safety property; the mid-pagination-fault test asserts `deleteAsset` is never called.
**Source:** 04-RESEARCH.md; 04-03-SUMMARY.md

### The editor/LSP diagnostic feed was stale for the entire phase
Every executor's "Cannot find module './x.js'" / implicit-any diagnostic was a false positive; `nx test`/`typecheck` (authoritative) were green each time. Never gated a decision on the LSP feed.

**Context:** consistent with the project CLAUDE.md rule; confirmed repeatedly across 04-01..04-06 and the fallow/lockfile fixes.
**Source:** executor SUMMARYs; new-diagnostics reminders vs nx runs

---

## Patterns

### Sequential-on-main execution when a plan mutates deps + cross-wave import chain
When one plan changes dependencies (04-05 added @octokit/rest) and later plans import both prior-plan code and the new dep, run executors sequentially on the main tree instead of in parallel worktrees.

**When to use:** a dep-changing plan + cross-wave import dependencies on a small/fast workspace — worktrees would need per-tree `npm ci` + merge coordination, disproportionate to the parallelism gained. (AGENTS.md sanctions "sequential-on-main" for dep-changing plans.)
**Source:** phase execution decision; AGENTS.md worktree strategy

### Injected narrow-client seam + fault-factory = fully unit-testable engines
Declare a minimal `PublishClient`/`CleanupClient` interface; the engine takes it injected; a shared `octokitFault` factory throws `{ status, response: { data: { errors: [{ code }] } } }`. The real Octokit adapter lives only in the thin bin.

**When to use:** any fault-branch-heavy I/O engine that must be tested across already-exists/404/5xx without live network.
**Source:** 04-03/04-04/04-05 SUMMARYs

### Config-assertion test: read tracked YAML, strip comments, prove non-vacuous by mutation
`cleanup-workflow.spec.ts` reads `.github/workflows/cleanup.yml` from disk, strips `#`-comment lines (so rationale prose repeating the same strings can't pass vacuously), and asserts security-load-bearing structure (contents:write only, cancel-in-progress:false). Non-vacuousness proven by mutating a COPY in a scratchpad and confirming each assertion fails.

**When to use:** giving a security-relevant workflow/config file automated coverage (RETAIN-03-class requirements).
**Source:** 04-VALIDATION.md (Nyquist audit)

### Aggregate fail-loud lives in the engine, symmetric across siblings
Both `publishMirror` and `cleanupMirror` call `core.setFailed` on `failed > 0` internally, so a systemic per-item regression can never report CI green.

**When to use:** any batch engine with per-item isolation — the aggregate-failure gate belongs at the engine seam, not deferred to a caller that might forget it.
**Source:** 04-REVIEW-FIX.md (WR-02)

### `max-parallel: 1` to serialize matrix legs that share a mutable cap check
The concurrent per-OS publish legs each read a snapshot of the shard's asset count; serializing with `max-parallel: 1` makes the later leg see the earlier leg's uploads, closing the 1000-asset-cap race without cross-leg coordination.

**When to use:** a matrix whose legs write to a shared resource guarded by a per-leg snapshot check.
**Source:** 04-REVIEW-FIX.md (WR-01)

---

## Surprises

### First push to main went red on EVERY job despite all local gates green
The cross-OS `npm ci` lockfile drift red-ed build, test, typecheck, format-check, fallow, integration, and publish simultaneously — because they all run `npm ci` first.

**Impact:** required diagnosing past the noise (every-job-red points at the shared first step, not 8 separate bugs), a container-based lockfile regen, and a second push. Also briefly pushed a red state to public main (backup ref made it restorable; fix-forward chosen).
**Source:** CI run 29726381233; fix 7fec51e

### The Nyquist auditor found a real gap rather than rubber-stamping
RETAIN-03 (cleanup.yml token scope + concurrency) had ZERO automated coverage — it was manual-review-only. The auditor generated a genuine, mutation-proven test rather than passing the phase on the orchestrator's "looks covered" read.

**Impact:** validates the never-self-certify rule; test count rose 227 -> 231; RETAIN-03 now regression-guarded.
**Source:** 04-VALIDATION.md

### The first phase-researcher spawn no-op'd (0 tool uses, ~6s)
The initial gsd-phase-researcher returned only a neutralized system-reminder with no file reads, writes, or RESEARCH COMPLETE marker.

**Impact:** required detecting the no-op (0 tool uses + no artifact on disk) and re-spawning a fresh researcher, which then did real work (39 tool uses). Minor delay; a reminder to verify subagent output against the filesystem, not just the return text.
**Source:** research step (first vs second spawn)
