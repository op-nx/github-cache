# Phase 2: Default Cache in CI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 2-Default Cache in CI
**Mode:** `--auto` (autonomous single-pass) + `--analyze` (trade-off tables)
**Areas discussed:** selectBackend seam, write-trust gate, withHashLock, actions-cache backend + archive-path, JS-action dogfood + SIGTERM

---

## selectBackend(env) seam shape (supersedes Phase 1 D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| serve()-internal swap | selectBackend called inside serve(), replacing the hard-wired memory backend | ✓ |
| Separate module | selectBackend as its own module serve() imports; RW/RO context-derived | ✓ (composed) |
| Keep memory RO fallback | memory backend as the local RO until Phase 3 | ✓ (placeholder) |

**Auto-selection:** `[auto] selectBackend seam - Q: "How does selectBackend wire into serve()?" -> Selected: pure selectBackend(env) module returning ONE CacheBackend; serve() calls it in place of createWritableMemoryBackend(); RW/RO 100% context-derived, no caller flag (recommended default).`
**Notes:** Supersedes the re-openable D-04 construction seam. Ties to ARCHITECTURE Decision 1 + TRUST-05. IMPACT med / CONFIDENCE high -> safe auto-lock. `env` is an explicit injectable param for testability (TEST-01).

---

## Write-trust gate (TRUST-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Predicate inside selectBackend | trust logic folded into selectBackend | |
| Separate isWriteTrusted(env) | single-purpose predicate selectBackend composes | ✓ |

**Auto-selection:** `[auto] write-trust gate - Q: "Where does the trust predicate live?" -> Selected: separate isWriteTrusted(env); TRUSTED_EVENTS=['push','schedule'] single source, default-deny, no denylist (recommended default).`
**Notes:** Dangerous events refused by construction + asserted by test. NO early `pull_request`/`release` widening (Phase 5). Seed ONE const now - the dependency-free action copy + selfcheck parity is Phase 5/TRUST-04 (avoid the PoC dual-copy debt). IMPACT high / CONFIDENCE high (C1/C2, Pitfall 1) -> safe auto-lock.

---

## withHashLock (TEST-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Map<hash,Promise> at write path | serialize same-hash, concurrent different, evict on settle | ✓ |
| Lock inside backend | backend owns the lock | |

**Auto-selection:** `[auto] withHashLock - Q: "Lock primitive + placement?" -> Selected: Map-of-in-flight-promises utility at the write path; evict-on-settle; no-wedge-on-reject (recommended default).`
**Notes:** Single-process / ephemeral-runner ceiling comment-locked; no distributed lock (out of scope). Fixes the PoC's under-tested lock bookkeeping (Pitfall 4). IMPACT med / CONFIDENCE high -> safe auto-lock.

---

## Actions-cache backend + archive-path + @actions/cache pinning (ROBUST-03, Pitfall 7)

| Option | Description | Selected |
|--------|-------------|----------|
| Single-source cacheArchivePath() comment-locked | sole path source; save/restore byte-identical | ✓ |
| Pin @actions/cache EXACT; test:act upgrade gate | version-hash stability | ✓ (mechanism -> R-01) |

**Auto-selection:** `[auto] actions-cache backend - Q: "Archive-path + pinning discipline?" -> Selected: @actions/cache pinned exact; cacheArchivePath() single source (comment-locked); saveCache -1 = benign no-op (gate handles safety) (recommended default).`
**Notes:** IMPACT HIGH (silent-MISS class) / CONFIDENCE high on the PATTERN. The `test:act` harness on arm64/QEMU is NOT auto-locked -> R-01 research item (real-CI canary vs local act).

---

## JS-action dogfood scope + SIGTERM drain (ROBUST-04, SC5, FOUND-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal internal dogfood action | this-repo CI only; published surface -> Phase 6 | ✓ |
| Full distributable action now | build the published surface early | |

**Auto-selection:** `[auto] JS-action dogfood - Q: "How much action to build + shutdown?" -> Selected: minimal dogfood-only JS action + serve SIGTERM in-flight-put drain (recommended default).`
**Notes:** JS action is the ONLY launch path for the Actions-cache backend (plain run: silently no-ops). IMPACT HIGH / CONFIDENCE high on SCOPE, medium on the launch/verify MECHANISM -> R-02 research item (Windows detached-stdio, permissions REPLACE-not-merge, real hit/miss assertion). Per the trap-quadrant rule, scope is locked but the mechanism is flagged, not silently locked.

---

## Claude's Discretion

- Exact internal module layout under `packages/github-cache/src/` (mirror Phase 1's one-lib/internal-modules shape).
- Whether the dogfood action lives under `packages/github-cache/action/` or a top-level `action.yml`.
- `test:act` target wiring vs the dormant `integration` target (see R-01).
- Local RO backend shape (RO wrapper over memory vs dedicated `createReadOnlyBackend()`).

## Open for Research / Verify (planner must resolve - NOT auto-locked)

- **R-01:** `test:act` feasibility on this arm64/QEMU host - real-CI canary vs local `act`.
- **R-02:** exact CI launch + verification of the dogfood action (Windows detached-stdio pitfall; job `permissions:` REPLACE-not-merge; real hit/miss assertion). HIGH-IMPACT / MEDIUM-CONFIDENCE - verify before lock.

## Deferred Ideas

- Releases reader + OS-namespacing + private-repo auth -> Phase 3.
- Publish/sync + cleanup/retention + observability -> Phase 4.
- `pull_request`/`release` trust-widening + TRUST-04 single-source allowlist + PPE gate -> Phase 5.
- Published npm/JS-action surface + background-step docs + governance -> Phase 6.
