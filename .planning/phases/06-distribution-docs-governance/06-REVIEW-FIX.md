---
phase: 06-distribution-docs-governance
fixed_at: 2026-07-21T00:00:00Z
review_path: .planning/phases/06-distribution-docs-governance/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-07-21
**Source review:** .planning/phases/06-distribution-docs-governance/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 3
- Skipped: 0
- Info findings (IN-01..IN-04): out of scope, left untouched.

## Fixed Issues

### WR-01: minimal-ci.yml comment falsely claims the pull-request backend is read-only

**Files modified:** `docs/examples/minimal-ci.yml`
**Commit:** a11db02
**Applied fix:** Rewrote the `GITHUB_TOKEN` env comment. It previously claimed
"On a pull request the backend is read-only," which is false: `pull_request`
is host-gated write-trusted on github.com, so `selectBackend` returns the
writable Actions-cache backend on PRs. The comment now states that
push/schedule and (on github.com) pull_request/release are write-trusted, and
that fork/PR cache writes are contained by GitHub's server-side read-only cache
guard + default-branch protection, not by local backend selection. Points the
reader to ../trust-and-security.md for the settled model.

### WR-02: advanced.md &-fallback example cannot work as written

**Files modified:** `docs/advanced.md`
**Commit:** df1364c
**Applied fix:** Replaced the broken snippet. The old version hardcoded
`http://localhost:3000` while `serve()` binds an OS-assigned ephemeral port when
`PORT` is unset, and wrote an undefined `$MY_TOKEN` to `GITHUB_ENV` *after* the
server had already minted its own CSPRNG token (so the client token never
matched the server's). The new snippet exports `PORT=3000` and a generated
`NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` BEFORE backgrounding so `serve()`
adopts both (serve.ts:69 reads `PORT`; serve.ts:70-73 adopts the token via `||`),
points the Nx client at `http://127.0.0.1:${PORT}` (the server binds 127.0.0.1),
writes the same token to `GITHUB_ENV`, and drops the spurious `serve` argument
(the bin ignores argv). Fallback stays scoped to the reader path; no
`ACTIONS_RUNTIME_TOKEN` in a plain run: step, matching the surrounding prose.

### WR-03: public-surface type-export guard only inspects the first export type block

**Files modified:** `packages/github-cache/src/public-surface.spec.ts`
**Commit:** b5a6bcf
**Applied fix:** Changed `parseTypeExports` from a non-global `.exec` (which read
only the first `export type { ... }` block) to `matchAll` with a global regex,
unioning the names across every type-export block. A second type-export
statement in index.ts can no longer escape the contract guard. The existing
exact-contract assertion behavior is preserved. Verified with
`npx nx test github-cache`: 474 tests passed (26 files), including the 12
public-surface guard tests.

## Skipped Issues

None.

## Post-review live-CI fix: DOCS-06 background-step export handshake

**Surfaced by:** a live GitHub Actions push. The `consumer-smoke` job failed with
`NX_SELF_HOSTED_REMOTE_CACHE_SERVER: background start-cache-server step did not
export the server url`.

**Root cause:** a `background: true` step's `core.exportVariable(...)` writes to
`$GITHUB_ENV`, which the runner only processes AFTER a step COMPLETES -- and a
background step does not complete until its `cancel:` teardown. So the action's
`exportVariable('NX_SELF_HOSTED_REMOTE_CACHE_SERVER'/'_ACCESS_TOKEN', ...)` calls
never reached later steps. The "action generates + exports the URL/token"
handshake cannot work for a background step.

**Fix (consumer-pre-sets / action-adopts):** `serve()` already adopts
`process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` (via `||`) and
`options.port ?? process.env.PORT`, so the consumer pre-sets the token + a fixed
port in a REGULAR step (whose `$GITHUB_ENV` writes propagate) and the action
adopts them.

| Commit    | Change                                                                                  |
| --------- | --------------------------------------------------------------------------------------- |
| `c47fa1c` | `entry.ts`: drop both `exportVariable` calls; fail fast if the token is unset; adopt token (env) + port (input); mask token + log the url. Rebuilt esbuild bundle `index.js`; `action.yml` documents the pre-set/adopt pattern. |
| `fb23e92` | `.github/workflows/ci.yml`: `consumer-smoke` pre-sets both `NX_*` vars in a regular step + passes `port: '3000'` to the background step. |
| `a92243a` | `README.md`, `docs/examples/minimal-ci.yml`, `docs/configuration.md`: consumer docs show the pre-set/adopt pattern. |

**Local verification:** `check:action` exit 0 (bundle in sync); `nx test
github-cache` 474 passed (docs-adoption + public-surface guards); `pack:check`
exit 0 (no tarball leaks); `nx format:check --all` clean; `package-lock.json`
untouched. `docs/advanced.md`'s `&`-fallback (WR-02) already used the pre-set
pattern, so it was left unchanged.

---

_Fixed: 2026-07-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
