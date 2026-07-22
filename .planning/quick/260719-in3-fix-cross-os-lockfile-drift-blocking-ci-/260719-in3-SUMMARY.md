---
quick_id: 260719-in3
status: complete
files_changed:
  - package-lock.json
commit: b9c513d
---

# Quick Task 260719-in3: Fix cross-OS lockfile drift blocking CI

## What was done

Regenerated `package-lock.json` from a clean full resolve in a Linux arm64 `node:24`
Docker container (matching CI's `lts/krypton`), `node_modules` masked so the host tree
could not bias the resolve. This restored the cross-platform WASM-fallback optional deps
that the `02-01` Windows workspace-scoped install had pruned, and incidentally dropped
284 stale `@verdaccio/*` / `@cypress/*` PoC-leftover entries.

Executed **inline, sequential on the main tree** (not a worktree): a dep-changing task
must not run against a worktree lacking `node_modules` (AGENTS.md), and the fix required
a Linux regen a Windows worktree cannot produce.

## Root cause

`npm ci` (strict) on Linux failed on every job with `Missing: @emnapi/core@1.11.1/@1.11.2
from lock file`. `@emnapi/*` is the WASM fallback (via `@napi-rs/wasm-runtime`) nested
under the `*-wasm32-wasi` optional bindings of `@oxc-resolver` / `@rolldown`. A
Windows-host workspace-scoped resolve pruned those optional subtrees; the lockfile stayed
self-consistent locally, so only Linux `npm ci` exposed it. See `260719-in3-RESEARCH.md`.

## Verification

| Check | Result |
|-------|--------|
| `npm ci` on Linux (Docker) | exit 0 |
| `npm ci` on Windows (local) | exit 0 (406 pkgs, 6s) |
| `npm ci` did not rewrite the lockfile | confirmed |
| `@emnapi` 1.11.1/1.11.2 restored under wasm32-wasi bindings | yes |
| win32 bindings dropped | none |
| `@actions/cache@6.2.0` / `@actions/core@3.0.1` pins | intact |
| nx test / typecheck / build | 100 tests, green |
| fallow dead-code / format:check | green |
| `test:act` self-skip off-CI | prints SKIP, exit 0 |
| **main-push CI (run 29685631933)** | **all 9 jobs green** |
| dogfood-seed | `stored 29685631933 (PUT 200)` |
| dogfood-verify (cross-job) | `cache HIT for 29685631933 with matching bytes` |

## Impact beyond this task

The live dogfood HIT also satisfies the Phase 2 `human_needed` verification item
(`02-VERIFICATION.md` / `02-UAT.md`, ROADMAP SC5 / ROBUST-03 end-to-end) -- Phase 2's
last outstanding gate is now cleared.

## Self-Check: PASSED
