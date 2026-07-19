---
quick_id: 260719-in3
status: passed
verified: 2026-07-19
score: 4/4 must-haves verified
---

# Quick Task 260719-in3: Verification

Verified against the live CI run, not just local state -- the strongest possible check
for a lockfile-portability fix.

## Must-haves

1. **Lockfile in sync for `npm ci` on both arm64 platforms** -- PASS.
   `npm ci` exits 0 in a Linux `node:24` container AND locally on Windows arm64.
   CI run 29685631933: `integration (ubuntu-24.04-arm)` and `integration (windows-11-arm)`
   both green (each runs `npm ci`).

2. **Linux WASM-fallback optional deps present** -- PASS.
   `@emnapi/core`+`@emnapi/runtime` @1.11.2 under `@oxc-resolver/binding-wasm32-wasi`
   and @1.11.1 under `@rolldown/binding-wasm32-wasi` are in the lockfile.

3. **No win32 bindings dropped; @actions pins intact** -- PASS.
   Key-level lockfile diff: 0 win32 entries removed; `@actions/cache@6.2.0` /
   `@actions/core@3.0.1` unchanged. The 284 removed entries are all stale
   `@verdaccio/*` / `@cypress/*` PoC leftovers, no longer declared.

4. **main-push CI fully green incl. live dogfood cache HIT** -- PASS.
   Run 29685631933, all 9 jobs `success`. Evidence:
   - `dogfood-seed`: `github-cache dogfood seed: stored 29685631933 (PUT 200).`
   - `dogfood-verify`: `Cache hit for: nx-cache-29685631933` -> `Cache restored
     successfully` -> `github-cache dogfood verify: cache HIT for 29685631933 with
     matching bytes.` (bearer token masked as `***`).

## Cross-reference

Satisfies the Phase 2 `human_needed` item in `02-VERIFICATION.md` (ROADMAP SC5 /
ROBUST-03 end-to-end). Phase 2's outstanding human-check is now cleared.
