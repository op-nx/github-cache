---
phase: 03-cross-context-read
fixed_at: 2026-07-19T19:17:26Z
review_path: .planning/phases/03-cross-context-read/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 1
status: all_fixed
gates:
  test: 162 passed (was 159; +3 new tests)
  typecheck: pass
  build: pass
constraints_honored:
  - "D-01 zero new dependency: package.json / package-lock.json unchanged"
  - "TRUST-05: selectBackend still synchronous, length === 0"
  - "native AbortSignal.timeout (Node 24), no undici/execa/etc."
  - "no Authorization re-attach on redirect; token never logged"
  - "ASCII only; braces on all control flow; blank lines around control flow/returns"
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-07-19T19:17:26Z
**Source review:** .planning/phases/03-cross-context-read/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (HI-01, HI-02, ME-01, LO-01)
- Fixed: 4
- Skipped / deferred: 1 (LO-02, optional per the brief)

Each behavior-changing fix followed red-green TDD: the new/updated spec was run
against the pre-fix source to confirm it failed for the right reason (non-vacuous),
then the source fix was applied and the spec re-run green. Full suite + typecheck +
build were re-run at the end. Test count went 159 -> 162 (+1 HI-01, +1 HI-02,
+1 ME-01; LO-01 is comment-only). No `package.json` / lockfile change (D-01).

## Fixed Issues

### HI-01: Repo-identity regex not anchored to the URL host (T-03-11)

**Files modified:** `packages/github-cache/src/lib/local-context.ts`, `packages/github-cache/src/lib/local-context.spec.ts`
**Commit:** 714ac3b
**Applied fix:** Replaced the substring-matching regex
`/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/` with a host-anchored form
`/^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?$/`,
matching only the two remote forms D-10 supports and updated the comment to state
why the host anchor is load-bearing. A URL that merely embeds `github.com` as a
path segment on another host now yields no match -> `undefined` -> MISS (the code
never guesses a repo). This is the reviewer's verified fix, applied verbatim.
**Verification:** Added a spec asserting the two adversarial URLs the reviewer used
(`https://evil.example.com/github.com/attacker-org/attacker-repo` and
`https://internal-proxy.corp/mirror/github.com/real-owner/real-repo.git`) resolve
to `undefined`. Confirmed red before the fix (the old regex returned
`attacker-org/attacker-repo`) and green after. All existing https/ssh/.git parse
cases and the gitlab.com negative case remained green.

### HI-02: No timeout on any GitHub REST fetch -- could wedge the build

**Files modified:** `packages/github-cache/src/backend/releases-backend.ts`, `packages/github-cache/src/backend/releases-backend.spec.ts`
**Commit:** 443ea9d
**Applied fix:** Added a module-level `FETCH_TIMEOUT_MS = 5000` (a parallel constant
to `HELPER_TIMEOUT_MS`, documented as an independent network-leg bound) and passed
`signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)` to all three fetch calls in
`createReleasesReadClient.fetchAsset` (release lookup, paginated asset list, asset
download). Uses the native Node 24 `AbortSignal.timeout`, so zero new dependency
(D-01/D-03). A timeout-triggered `AbortError` degrades to a warned MISS through the
port's existing `try/catch` (SRV-05 / D-11) with no other change; the download's
redirect handling and headers are untouched (no `redirect: 'manual'`, no Authorization
re-attach).
**Verification:** Added a spec asserting each of the three fetches carries an
`AbortSignal`. Confirmed red before the fix (init `signal` was `undefined`) and green
after. The existing redirect / header assertions and the whole fault matrix stayed
green.

### ME-01: Token and repo identity re-resolved on every get()

**Files modified:** `packages/github-cache/src/backend/releases-backend.ts`, `packages/github-cache/src/backend/releases-backend.spec.ts`
**Commit:** 667a97d
**Applied fix:** Memoized both resolutions inside the client closure via
`let cachedToken` / `let cachedRepo` and `cachedToken ??= resolveLocalReadToken(env)`
/ `cachedRepo ??= resolveRepoIdentity(env)`. Caches the promise (not the value), so
concurrent first-use calls collapse onto one in-flight resolution. Resolution still
happens at get-time (first `fetchAsset`), never at `selectBackend` construction, so
`selectBackend` stays synchronous and zero-arity (TRUST-05); the cache is per client
instance, not global. This also bounds HI-02's hang exposure to once-per-client
rather than once-per-lookup. The reviewer's verified fix, applied.
**Verification:** Added a spec asserting the (mocked) resolvers run exactly once
across three `fetchAsset` calls on one client, and that a second client re-resolves
(proving per-instance, not global, caching). Confirmed red before the fix (resolvers
ran 3x) and green after.

### LO-01: Circular-import safety argument lived only in a planning artifact

**Files modified:** `packages/github-cache/src/lib/local-context.ts`
**Commit:** d236cf2
**Applied fix:** Added a concise source comment at the cycle-closing import
(`local-context.ts` importing `./select-backend.js`) documenting the 3-file cycle
`select-backend -> releases-backend -> local-context -> select-backend`, why it is
safe (every imported binding is read only inside a function body, never at
module-evaluation time -> no TDZ hazard), and the constraint to preserve (do not
read select-backend's exports at this file's top level; no `import/no-cycle` lint
rule exists to catch a regression). Comment-only, no behavior change.
**Verification:** Re-read the change (Tier 1); typecheck + build + full test suite
green.

## Skipped / Deferred Issues

### LO-02: GitHub JSON responses consumed via bare `as` assertions

**File:** `packages/github-cache/src/backend/releases-backend.ts:194,217-220`
**Reason:** Deferred by instruction. The brief marked LO-02 optional ("skip unless
the fix is trivial and adds no dependency"), and the reviewer rated it low, noting it
is a defense-in-depth / code-quality note rather than a live bug: the port's
existing `try/catch` already degrades a malformed shape to a warned MISS, and a bad
`release.id` degrades cleanly through the existing 404 branch. Adding runtime shape
guards is a non-trivial edit across multiple call sites for no behavioral change
given the existing catch-all safety net, so it was left for a future hardening pass.
**Original issue:** Both `(await releaseResponse.json()) as { id: number }` and
`(await listResponse.json()) as { id: number; name: string }[]` are compile-time-only
assertions with no runtime validation of GitHub's response shape.

---

_Fixed: 2026-07-19T19:17:26Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
