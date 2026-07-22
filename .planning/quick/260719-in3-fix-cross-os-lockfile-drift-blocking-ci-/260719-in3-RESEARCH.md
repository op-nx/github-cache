# Quick Task 260719-in3: Research -- Cross-OS lockfile drift

**Gathered:** 2026-07-19

## Symptom

Every job in the `main`-push CI run failed at `npm ci` (dogfood-verify skipped via
`needs: dogfood-seed`). Local gates were green; only Linux `npm ci` (strict) exposed it:

```
npm error `npm ci` can only install packages when your package.json and
package-lock.json are in sync.
npm error Missing: @emnapi/core@1.11.1 / @1.11.2 (and @emnapi/runtime) from lock file
```

## Root cause

`@emnapi/*` is the WASM fallback runtime for native modules, reached via
`@napi-rs/wasm-runtime`, nested under the `*-wasm32-wasi` optional bindings of
`@oxc-resolver` and `@rolldown` (both pulled in by `fallow` / Nx tooling).

The `02-01` install ran `npm install --save-exact --workspace @op-nx/github-cache ...`
on this **Windows arm64** host. A workspace-scoped resolve on a single platform pruned
the cross-platform optional subtrees that a Linux `npm ci` validates against. Evidence:

| Lockfile | `@emnapi/core` versions |
|----------|-------------------------|
| Pre-Phase-2 baseline (`98da97a`) -- CI `npm ci` passed | `1.4.5`, `1.11.1`, `1.11.2` |
| Post-`02-01` (drifted) | `1.4.5` only |

The lockfile stayed self-consistent on Windows (`npm install --package-lock-only` was a
no-op locally), so local gates and the phase verifier could not see it. Only a strict
Linux `npm ci` -- which validates the full ideal tree including all-platform optionals --
exposed the gap. Regenerating on Windows reproduced the prune; a Linux regen was required.

## Secondary finding

The drifted lockfile also carried 284 stale `@verdaccio/*` + `@cypress/*` package
entries -- dead weight from the Phase 0 PoC teardown (Verdaccio local registry), no
longer declared in any `package.json`. A clean full resolve drops them.

## Fix approach (chosen)

Regenerate the lockfile from a clean full resolve in a Linux arm64 `node:24` container
(matching CI's `lts/krypton`), with `node_modules` masked (anonymous volume) so the host
tree cannot bias the resolve. This is the reliable way to capture the cross-platform
optional deps that a Windows-host resolve prunes.

## Pitfalls avoided

- **Never re-run `npm install` on Windows after the Linux regen** -- it re-prunes the
  Linux optionals and silently re-breaks CI. Verify with `npm ci` (read-only on the
  lockfile) on both platforms instead.
- **Do not hand-edit the lockfile** (project rule / threat model T-2-02): regenerate via npm.
- **Prove both platforms**: `npm ci` must pass on Linux (Docker) AND Windows (local), since
  CI runs `npm ci` on both `ubuntu-24.04-arm` and `windows-11-arm`.
