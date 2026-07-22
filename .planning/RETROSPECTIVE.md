# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.0.1 — Greenfield MVP Rebuild

**Shipped:** 2026-07-22
**Phases:** 7 | **Plans:** 33 | **Tasks:** 63 | **Commits:** ~366 over 5 days (2026-07-17 → 2026-07-22)

### What Was Built
- Nx self-hosted-cache HTTP server (loopback bind, timing-safe bearer auth, hash validation, 2 GB body cap, best-effort read / fail-closed write) — zero runtime deps at the core.
- Actions-cache CI-RW backend + context-derived `selectBackend` (one backend per process, no caller-facing mode flag) + per-hash lock + SIGTERM drain.
- Authenticated GitHub Releases read-only reader, OS-namespaced so a cross-OS hit never serves a wrong-OS artifact; private-repo-capable local read.
- `{push,schedule}`-gated publish/cleanup engines, one coupled retention knob, fail-loud observability, ~2 GiB and 1000-asset graceful degradation.
- Host-detected fail-closed trust-widening + single-source `trust.ts` allowlist + server-produced-key mirror filter + shipped advisory PPE-hygiene gate.
- npm package + `uses:`-consumable `start-cache-server` JS action + background-step CI sidecar pattern + enumerated/tested public surface + adoption docs + SECURITY.md/LICENSE/semver.

### What Worked
- **Test-first (RED→GREEN) discipline** held across all build phases; mechanisms (sha256 conformance drift guard, pin guards, trust-allowlist deep-equality) were proven RED before GREEN.
- **Single-source-of-truth + drift guards** — `trust.ts`/`sync-gate.ts` allowlists, the enumerated public-surface spec, and the docs-adoption guard each fail the build on unintended change, so the consumer contract can't silently drift.
- **Vertical MVP slices** each landed one dogfoodable capability; the audit + fresh integration re-check found no regressions across the ~89 post-baseline hardening commits.

### What Was Inefficient
- **Live-CI-only bugs.** Three real distribution bugs — cross-OS lockfile drift (esbuild → missing `@emnapi`, `npm ci`), the background-step export handshake, and a readiness-poll/cache-key collision — passed every local gate AND the verifier, and only surfaced on real GitHub Actions. It took 5 live pushes to close them.
- **Dual-root trust copy churn.** The `trust.generated.cjs`/`selfcheck.cjs` pre-`npm-ci` copy was built, guarded, then superseded by esbuild bundling and ultimately removed — effort spent on a file nothing ended up consuming.
- **Requirements-checkbox lag.** VERIFICATION.md verdicts led REQUIREMENTS.md checkboxes by a day, briefly making the 3-source cross-reference look inconsistent (documented convention, but noise).

### Patterns Established
- Host-detected (`GITHUB_SERVER_URL`) fail-closed trust widening; the in-code gate is defense-in-depth, not the load-bearing control.
- A **separate** sync/publish predicate (`{push,schedule}`) distinct from the write-trust gate.
- One coupled retention knob (`CACHE_MIRROR_MAX_AGE_DAYS` → `resolveMaxAgeDays`/`shardTagsForWindow`) drives both read-lookback and cleanup — never a second knob.
- Background-step CI sidecar pattern (`background:`/`cancel:`) as the JS-action-launched Actions-cache path; plain `&` fallback for GHES/older runners.
- First-push "live-close" for behaviors no local harness can exercise (GitHub Actions runtime, per-OS cache-version hashing).

### Key Lessons
1. **Local gates cannot prove GitHub Actions runtime behavior.** Background-step export-variable propagation, the `background`/`cancel` lifecycle, and GitHub's per-OS cache-version hashing are only provable on a real runner — plan an explicit live first-push close for each, don't treat green-local as done.
2. **Single-source-of-truth + a byte/semantic drift guard beats a hand-synced second copy.** Every dual-root artifact drifted or became dead weight; the bundle-from-one-source approach won.
3. **Cross-OS parity is load-bearing and silent when broken** — `.gitattributes eol=lf`, OS-discriminated hashes, and a per-OS matrix must all stay; regressions here fail as invisible all-MISS, not as errors.

### Cost Observations
- Model mix: not instrumented this milestone.
- Notable: the audit + independent integration re-check (with live suite execution) added high confidence at low marginal cost — both prior tech-debt items were already resolved by the time of the re-audit.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.0.1 | 7 | 33 | Greenfield vertical-slice rebuild; TDD + live-CI first-push close established |

### Cumulative Quality

| Milestone | Unit tests | E2E flows wired | Threats open |
|-----------|-----------|-----------------|--------------|
| v0.0.1 | 430 | 6/6 | 0 |

### Top Lessons (Verified Across Milestones)

1. Local gates cannot substitute for a live GitHub Actions run of runtime-only behaviors. *(v0.0.1 — re-verify next milestone.)*
