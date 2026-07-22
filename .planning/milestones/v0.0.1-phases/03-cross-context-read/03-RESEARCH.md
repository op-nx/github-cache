# Phase 3: Cross-Context Read - Research

**Researched:** 2026-07-19
**Domain:** Authenticated GitHub Releases read-only cache reader; local three-tier auth via subprocess; OS-namespaced key scheme
**Confidence:** HIGH (the four open questions were resolved by direct empirical probe on the exact target runtime -- Node 24.13.0 win32/arm64 -- not by training recall)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Reader Backend & Integration
- **D-01:** The local/untrusted branch of `selectBackend` returns a real GitHub Releases
  read-only reader, replacing the `createReadOnlyMemoryBackend()` placeholder at
  `select-backend.ts:40-42`. RW/RO stays 100% context-derived - no caller-facing mode flag
  (TRUST-05).
- **D-02:** The reader implements the `CacheBackend` port (`backend/types.ts`):
  `get(hash) -> hit|miss`, `put(hash, bytes) -> 'forbidden'`. Read-only by construction,
  mirroring `createReadOnlyMemoryBackend` (`memory-backend.ts:46-58`). No local write path.
- **D-03:** HTTP via native global `fetch` (Node 24) - NO new dependency (D-01 zero-dep-lean).
  REST sequence proven by spike 001: GET release by shard tag -> paginated asset list ->
  GET asset by id with `Accept: application/octet-stream` + `Authorization: Bearer`. Octokit
  stays a Phase 4 (write/cleanup) concern.
- **D-04:** The reader accepts an INJECTED release read-client (minimal resolve/list/download
  shape) defaulting to the real `fetch` implementation. The injected client is NOT a mode
  flag (TRUST-05 intact) - it exists so TEST-05 can seed a deterministic fake. `selectBackend`
  always constructs the reader with the real default client.

#### OS-Namespacing (CORR-01)
- **D-05:** Namespace ALL entries by default. The Releases asset name folds in the OS
  discriminator (e.g. `<hash>-<platform>`), so a wrong-OS lookup always MISSes. NO per-target
  portable/non-portable classification (ARCHITECTURE-DECISION Decision 6; CORR-01 "by
  default"; no portability signal exists in the codebase to classify against). OS-invariant
  re-caching per OS is an accepted, fully reversible MVP cost.
- **D-06:** OS discriminator = runtime `process.platform`, mapped `win32 -> windows`,
  `darwin -> macos`, else `linux` (memory `os-sensitive-nx-hash-discriminator`: compiled-in,
  emulation-proof, shell-invariant - proven on windows-11-arm under QEMU; `env:RUNNER_OS` is
  CI-only and unusable locally).
- **D-07:** The asset-name scheme lives in ONE comment-locked single-source helper, following
  the `cache-archive-path.ts` template (D-03 pattern). Phase 4's publisher consumes the SAME
  helper - the key scheme settles in Phase 3. A drift between save-side and read-side derivation
  is a silent cross-OS MISS (the exact `cache-archive-path` failure class the single-source rule
  prevents).

#### Auth & Repo Identity (FOUND-02)
- **D-08:** Full three-tier local auth chain via a NEW `resolveLocalReadToken` resolver:
  reuse `resolveGitHubToken(env)` (env tier: `GH_TOKEN||GITHUB_TOKEN`, unchanged) ->
  `gh auth token` -> `git credential fill`. Do NOT extend `resolveGitHubToken` in place - it is
  env-only by design, shared with the CI write path in `selectBackend`, and its fallthrough is
  pinned by TEST-01 (`select-backend.spec.ts:162-179`). Parse tokens STRUCTURALLY (stdout on
  exit 0), NEVER by stderr text (ARCHITECTURE-DECISION:9, PITFALLS:233 - the PoC gh-stderr
  coupling hazard).
- **D-09:** NO anonymous/public fallback (FOUND-02 forbids it). If no token resolves, the reader
  degrades to MISS - never drops to the anonymous 60 req/hr tier.
- **D-10:** Local repo identity resolves from `git remote get-url origin` (with a documented env
  override), since `GITHUB_REPOSITORY` is CI-only / locally absent (spike 001 passed owner/repo
  as CLI args). If repo identity cannot be resolved, reads MISS.

#### Degradation (SC4 / SRV-05)
- **D-11:** Every read fault - missing asset (404), auth failure (401/403), rate limit (429),
  network error - is caught and returned as `{ kind: 'miss' }`, never thrown. Fault
  discrimination is STRUCTURAL (`res.status`), never stderr/text matching. Degradation emits a
  concise one-time stderr warning (build-friendly); workflow annotations are Phase 4 (OBS-01).

#### TEST-05 Strategy
- **D-12:** TEST-05 in Phase 3 is an injected/faked-Releases-client test: seed per-OS entries
  in-memory, assert correct-hit for the matching OS and MISS for a wrong-OS lookup (never a
  wrong-OS artifact), covering BOTH an OS-invariant and an OS-sensitive hash. Matches the repo's
  TEST-01/02 injected-client convention. The real live-GitHub cross-OS CI matrix round-trip is
  DEFERRED to Phase 4 (the publisher exists there); it was already proven on paper by spike 005
  (run 29613149528, all green). Also carry the "must-not-reopen" cross-OS invariant regression
  guards (`.gitattributes eol=lf`, single-source helpers).

### Claude's Discretion

Exact helper/function/module names, file layout within `packages/github-cache/src`, the precise
injected fake-client interface shape, and warning-message wording are at the planner/executor's
discretion within the decisions above.

### Deferred Ideas (OUT OF SCOPE)

- Real live-GitHub cross-OS CI matrix round-trip (the TEST-05 "live" variant) -> Phase 4 (needs
  the publisher). Already proven on paper by spike 005.
- Month-shard read-WINDOW walk (`shardTagsForWindow`, coupled to the `CACHE_MIRROR_MAX_AGE_DAYS`
  retention knob) -> settle in Phase 4. Phase 3 owns only the OS-namespaced asset-NAME scheme and
  may stub the shard-walk to a single known location.
- OS-invariant cross-OS sharing (relax namespacing for classified-portable targets) -> later
  optimization; additive, no consumer-contract impact.
- Octokit convergence for the read path -> Phase 4 consistency note if the publisher standardizes
  on Octokit.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-02 | Local read uses the developer's existing GitHub auth (git credential helper / `gh` / `GH_TOKEN`\|`GITHUB_TOKEN`) and MUST work for private repos; MUST NOT depend on anonymous/public access | Three-tier chain contract VERIFIED empirically on Node 24.13.0 win32/arm64 (see "Auth Tier Contracts"). Private-repo authenticated read proven by spike 001 (byte-identical x3, anon blocked 404). D-09 no-anon-fallback is enforced by returning MISS when every tier yields nothing. |
| CORR-01 | The store is OS-namespaced by default, so a cross-OS hit never serves a wrong-OS artifact | Single-source asset-name helper `<hash>-<platform>` (spike 005 line 94 pattern, live-proven run 29613149528). Injectable platform param is the design requirement that lets one CI leg assert all three OS mappings + simulate a wrong-OS reader (see "Pattern 2"). |
| TEST-05 | Regression guards for the must-not-reopen cross-OS invariants AND a cross-OS round-trip through the chosen reader adapter (OS-invariant + OS-sensitive hash) | Four concrete guards enumerated in "Cross-OS Regression Guards". Fake-client seam (one method, Map-backed) makes the cross-OS assertion trivial and non-vacuous. Live matrix leg deferred to Phase 4 per D-12. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

Directives the planner must honor; these carry the same authority as locked decisions.

| Directive | Source | Consequence for Phase 3 |
|-----------|--------|-------------------------|
| Zero-dep-lean: no new runtime dependency | CONTEXT D-03, `package.json` (only `@actions/cache`, `@actions/core`) | Use global `fetch` + `node:child_process`. Do NOT add Octokit, undici, execa, or a token-helper package. |
| ASCII only -- no emoji, no em/en dash, no box-drawing, no curly quotes | Global CLAUDE.md | Applies to source, comments, warning strings, and test names. Warning text must be plain ASCII (it goes to a Windows cp1252 console). |
| Blank lines around control flow and `return` | Global CLAUDE.md (JS/TS style) | Every `if`/`for`/`try`/`return` in new code gets a surrounding blank line. |
| Always use braces for control-flow bodies | Global CLAUDE.md | No braceless one-liners, including in `catch`. |
| Prefer running tasks through `nx` | AGENTS.md | Verify with `npx nx test github-cache`, not a bare `vitest`. |
| `||` not `??` for env-fed token/credential fallbacks | PITFALLS Pitfall 8; `select-backend.ts:23` | The new `resolveLocalReadToken` chain must coalesce with `||` / falsy checks so a set-but-empty value falls through. |
| GSD workflow gate before file edits | Project CLAUDE.md | Planner routes implementation through `/gsd:execute-phase`. |
| TDD mandatory | `config.json` `workflow.tdd_mode: true` | Every behavior below needs a failing test first. |

## Summary

Phase 3 replaces one line of `select-backend.ts` (the `createReadOnlyMemoryBackend()` placeholder
at lines 40-42) with a real, read-only GitHub Releases reader. The technical surface is small and
almost entirely covered by existing in-repo patterns: the `CacheBackend` port already defines the
contract, `createReadOnlyMemoryBackend` already models `put -> 'forbidden'`, `cache-archive-path.ts`
already models the comment-locked single-source helper, and `actions-cache-backend.spec.ts` already
models the recorded-argument agreement assertion that catches single-source drift. The genuinely
new ground is (a) spawning subprocesses, which has no in-repo precedent, and (b) the HTTP fault
surface.

Both were resolved empirically rather than from recall. **All four auth/spawn behaviors were probed
directly on Node 24.13.0 / win32 / arm64** (this repo's exact target): `execFile('gh', ...)` resolves
the `.exe` with no extension and no shell; a non-zero exit rejects with a numeric `err.code`; a
missing binary rejects with the string `err.code === 'ENOENT'`; and `git credential fill` returns
`protocol/host/username/password` key-value lines on exit 0. The single most valuable finding is a
negative one: **`git credential fill`'s failure stderr is LOCALIZED** -- it came back in Danish on
this machine ("Der opstod en fejl under afsendelse af anmodningen"). That is hard, reproducible proof
that the D-08/D-11 "never match stderr text" rule is not stylistic caution but a correctness
requirement; any stderr sentinel would silently misfire for every non-English developer.

The second key finding closes the redirect question: native `fetch` **automatically follows** the
Releases asset 302 to `objects.githubusercontent.com` and **drops the `Authorization` header on that
cross-origin hop**, per the WHATWG Fetch change (whatwg/fetch#1544) that undici implements. This is
exactly the behavior the download needs -- the signed redirect target carries its own query-string
auth and would reject a second credential -- and it is why spike 001's plain `fetch` round-tripped
byte-identical three times with no redirect handling at all. **Do not set `redirect: 'manual'` and do
not re-attach the header.** Doing either would break a currently-working path.

The third finding is a simplification. Because D-11 collapses every fault to MISS, the reader does
**not** need a fault taxonomy: 401, 403-permission, 403-secondary-rate-limit, 404-absent,
404-hidden-private, 429, 5xx, and a thrown network error all produce the identical
`{ kind: 'miss' }`. Status discrimination earns its keep only for the quality of the one-time
warning, never for control flow. One `try/catch` plus one `res.ok` check at the backend's `get` is
the complete, correct implementation -- and placing that catch at the port boundary (rather than
inside the client) also protects against an injected fake that throws.

**Primary recommendation:** Build one file per concern -- `release-asset-name.ts` (single-source
`<hash>-<platform>` helper with an injectable platform param), `local-context.ts` (the `gh` /
`git credential fill` / `git remote` subprocess tier, one shared hardened exec wrapper), and
`releases-backend.ts` (the `CacheBackend` reader taking a one-method injected client). Put the
degrade-to-MISS `try/catch` at `get`, spawn with `execFile`/`spawn` at `shell: false` with an
explicit `timeout` and `GIT_TERMINAL_PROMPT=0`, and let native `fetch` handle the redirect untouched.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Serving cache bytes to Nx over HTTP | Local loopback server (`server.ts`) | -- | Already built in Phase 1; Phase 3 changes nothing here. The reader plugs in behind the existing `CacheBackend` port. |
| Selecting RW vs RO backend | Local process context (`select-backend.ts`) | -- | Context-derived only (TRUST-05). Phase 3 swaps the RO branch's factory; the decision logic itself is untouched. |
| Cache artifact storage | GitHub Releases (remote) | -- | FOUND-01 LOCKED. Read-only from the local tier; the write/publish tier is Phase 4 and deliberately behind no port. |
| Credential acquisition | Local developer machine (env -> `gh` -> git credential helper) | -- | FOUND-02. Must never reach the anonymous tier (D-09). Belongs local-side because CI uses the separate, env-only `resolveGitHubToken` path. |
| Repo identity resolution | Local git working tree (`git remote get-url origin`) | Env override | `GITHUB_REPOSITORY` is runner-injected and absent locally (D-10). |
| OS discrimination | Local Node runtime (`process.platform`) | -- | Compiled into node, so shell-invariant and emulation-proof; `env:RUNNER_OS` is CI-only (D-06, memory `os-sensitive-nx-hash-discriminator`). |
| Fault -> MISS degradation | Local backend `get` (port boundary) | -- | Placing it at the port -- not inside the HTTP client -- makes the guarantee hold for an injected client too, and keeps it in exactly one place (SRV-05, D-11). |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Global `fetch` (undici, built into Node) | Node 24.13.0 (`v24` runtime confirmed) | All GitHub REST calls + asset download | Zero new dependency (D-03). Implements the WHATWG redirect/Authorization semantics the asset download depends on. Already used by `serve.spec.ts` for its round-trip assertions, so the repo has precedent. |
| `node:child_process` (`execFile`, `spawn`) | stdlib | `gh auth token`, `git credential fill`, `git remote get-url origin` | stdlib; `execFile` (no shell) is the injection-safe form. No in-repo precedent, so the pattern is established here. |
| `node:util` `promisify` | stdlib | Promise-wrapping `execFile` | Avoids hand-rolled callback plumbing; one line. |
| `vitest` | workspace-configured | Specs | Existing test runner (`nx test github-cache`); `vi.mock` module-mocking precedent exists in `actions-cache-backend.spec.ts`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:buffer` `Buffer` | stdlib | Asset bytes -> `GetHit.bytes` | `Buffer.from(await res.arrayBuffer())`, exactly as spike 001 line 115. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Global `fetch` | `@octokit/rest` | Adds a dependency tree, violating D-03/zero-dep-lean. Octokit's real value (structural `error.status`, pagination helpers) matters on the Phase 4 publish/cleanup path where a false "absent" is destructive; on the read path every fault is MISS anyway, so it buys nothing here. Revisit as a Phase 4 consistency note only. |
| `execFile` | `execa` | New dependency for what stdlib does in ~10 lines. Rejected. |
| `execFile` with `shell: false` | `exec` / `shell: true` | `shell: true` re-introduces command injection surface and requires quoting `C:\Program Files\GitHub CLI\gh.exe` (a real path with two spaces on this machine). Verified unnecessary: `gh` and `git` are native `.exe`, which `CreateProcess` resolves from PATH with no extension. Only `.cmd`/`.bat` shims would need a shell -- neither tool is one. |
| Injected client with resolve/list/download methods | Injected client with ONE `fetchAsset(name)` method | The one-method shape puts the seam exactly at the OS-namespaced asset NAME, which is precisely the boundary CORR-01/TEST-05 must prove. It makes the fake a `Map` and keeps the REST sequence testable separately by mocking `fetch`. Strongly preferred. |
| `process.platform` read directly inside the helper | Helper takes an optional `platform` parameter defaulting to `process.platform` | The parameter is required for testability: it lets one CI leg assert all three OS mappings and simulate a wrong-OS reader. It is NOT a mode surface (it cannot influence RW/RO), so TRUST-05 is intact. |

**Installation:** none. Phase 3 adds zero packages.

```bash
# No install step. Verify the runtime instead:
node --version   # v24.13.0 confirmed on this machine
```

## Package Legitimacy Audit

**Not applicable -- Phase 3 installs no external packages.**

The phase is implemented entirely with Node stdlib (`node:child_process`, `node:util`, `node:buffer`)
and the built-in global `fetch`. No registry lookup is required because no package name enters the
dependency graph. `package.json` remains at exactly `@actions/cache@6.2.0` and `@actions/core@3.0.1`,
both exact-pinned and already guarded by `src/pinned-deps.spec.ts` (ROBUST-03).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Planner note: if any task proposes adding a package (an HTTP client, a token helper, a subprocess
wrapper), that task contradicts D-03 and must be rejected rather than audited.

## Architecture Patterns

### System Architecture Diagram

```
                       Nx CLI (developer machine, any OS)
                                    |
                                    | GET /v1/cache/{hash}   (bearer, loopback)
                                    v
                    +-------------------------------+
                    |  createCacheServer (Phase 1)  |   unchanged
                    +-------------------------------+
                                    |
                                    | backend.get(hash)
                                    v
                    +-------------------------------+
                    |  selectBackend(env)           |   isWriteTrusted? -> no
                    +-------------------------------+
                                    |
                                    | (D-01) replaces the placeholder
                                    v
              +-----------------------------------------------+
              |  createReleasesReadBackend(client)            |
              |                                               |
              |   put()  -> 'forbidden'        (D-02, 403)    |
              |   get()  -> ONE try/catch, every fault -> MISS|
              +-----------------------------------------------+
                       |                          |
      releaseAssetName(hash, platform)       client.fetchAsset(name)
                       |                          |
                       v                          v
        +--------------------------+   +--------------------------------+
        |  <hash>-<platform>       |   |  INJECTED SEAM (D-04)          |
        |  single-source helper    |   |  real default | fake for tests |
        |  (D-05/D-06/D-07)        |   +--------------------------------+
        +--------------------------+                |
                                                    | real client only
                          +-------------------------+-------------------------+
                          |                                                   |
                          v                                                   v
            +---------------------------+                    +--------------------------------+
            | resolveLocalReadToken()   |                    |  resolveRepoIdentity()         |
            |  1. GH_TOKEN||GITHUB_TOKEN|                    |   env override                 |
            |  2. gh auth token         |  (subprocess)      |   else git remote get-url      |
            |  3. git credential fill   |  (subprocess)      |        origin   (subprocess)   |
            |  none -> undefined -> MISS|                    |   unparseable -> MISS          |
            +---------------------------+                    +--------------------------------+
                          |                                                   |
                          +-------------------------+-------------------------+
                                                    |
                                                    v
                        +-----------------------------------------------+
                        |  GitHub REST  api.github.com  (5000/hr authed)|
                        |                                               |
                        |  1. GET /releases/tags/{shardTag}   -> id     |
                        |  2. GET /releases/{id}/assets?per_page=100    |
                        |        PAGINATE (inline .assets is page 1 only)|
                        |  3. GET /releases/assets/{assetId}            |
                        |        Accept: application/octet-stream       |
                        +-----------------------------------------------+
                                                    |
                                                    | 302 cross-origin
                                                    v
                        +-----------------------------------------------+
                        | objects.githubusercontent.com (signed URL)    |
                        | fetch auto-follows; Authorization DROPPED     |
                        | by spec -- signed query-string auth applies   |
                        +-----------------------------------------------+
                                                    |
                                                    v
                                          Buffer -> { kind: 'hit', bytes }
```

### Recommended Project Structure

```
packages/github-cache/src/
  lib/
    release-asset-name.ts       # NEW: single-source <hash>-<platform> helper (D-05/06/07)
    release-asset-name.spec.ts  # NEW: pinned-literal guard, mirrors cache-archive-path.spec.ts
    local-context.ts            # NEW: resolveLocalReadToken + resolveRepoIdentity + exec wrapper
    local-context.spec.ts       # NEW: mocked node:child_process, tier fallthrough
    select-backend.ts           # EDIT: lines 40-42 placeholder -> real reader (D-01)
  backend/
    releases-backend.ts         # NEW: CacheBackend reader + real fetch client (D-02/03/04)
    releases-backend.spec.ts    # NEW: fault->MISS matrix, put->forbidden, TEST-05 cross-OS
```

Rationale for `local-context.ts` holding both resolvers: they share one hardened exec wrapper and
are both "resolve local developer context via subprocess." Splitting them into two files duplicates
the wrapper or forces a third file for it. (Lazier alternative if the planner prefers: keep them
together now and split only if a Phase 4 consumer needs one without the other.)

### Pattern 1: The hardened subprocess wrapper (no in-repo precedent -- establish it here)

**What:** One promisified `execFile` call with four non-negotiable options, wrapped so *any*
failure returns `undefined` instead of throwing.

**When to use:** Every one of the three subprocess call sites (`gh auth token`,
`git credential fill`, `git remote get-url origin`).

**Why each option is load-bearing (all VERIFIED empirically on Node 24.13.0 win32/arm64):**

| Option | Why |
|--------|-----|
| `shell: false` | Injection-safe. Verified unnecessary to set `true`: `execFile('gh', ...)` resolved `C:\Program Files\GitHub CLI\gh.exe` from PATH with no extension and no quoting, despite two spaces in the path. |
| `timeout: 5000` | A hung credential helper (GCM waiting on a locked keychain, a network-probing helper) would otherwise wedge the developer's build indefinitely. |
| `windowsHide: true` | Prevents a console window flash on Windows for each spawn. |
| `env` with `GIT_TERMINAL_PROMPT: '0'` | Verified: without it, `git credential fill` can block on an interactive prompt. With it, the miss path fails fast (exit 128) instead of hanging. |
| `env` neutralizing `GIT_ASKPASS`/`SSH_ASKPASS` | Verified: git still attempted `git-askpass.exe` even with terminal prompts disabled. On a GUI desktop that can pop a modal dialog and block the build. Neutralize both. |

```typescript
// Source: verified empirically, Node 24.13.0 win32/arm64 (this repo's target runtime)
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Run a local credential/context helper and return its trimmed stdout, or
 * undefined when the tool is absent, fails, times out, or prints nothing.
 *
 * LOAD-BEARING: discrimination is STRUCTURAL ONLY (did it resolve, and is stdout
 * non-empty). stderr is NEVER read or matched. Verified 2026-07-19: git's failure
 * stderr is LOCALIZED to the system language -- it returned Danish text on this
 * machine -- so any stderr sentinel silently misfires for non-English developers.
 * That is the PITFALLS:233 gh-stderr coupling hazard, confirmed with evidence.
 *
 * A single catch-all is correct here: execFile rejects with a NUMERIC err.code
 * for a non-zero exit but the STRING 'ENOENT' when the binary is missing, so the
 * property is overloaded and must not be switched on. Every failure means the
 * same thing to the caller -- this tier yielded no credential, try the next.
 */
async function tryHelper(
  file: string,
  args: readonly string[],
  input?: string,
): Promise<string | undefined> {
  try {
    const { stdout } = await run(file, [...args], {
      shell: false,
      timeout: 5000,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
        SSH_ASKPASS: '',
      },
    });

    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
```

Note: `git credential fill` needs stdin, which `execFile` cannot supply -- use `spawn` for that one
call site and write the request to `child.stdin`. Verified working shape is in "Code Examples".

### Pattern 2: The single-source asset-name helper with an injectable platform

**What:** One comment-locked function producing `<hash>-<platform>`, taking an optional platform
so tests can exercise every branch and simulate a wrong-OS reader.

**When to use:** Every derivation of an asset name, read-side now and publish-side in Phase 4.

```typescript
// Source: spike 005 ci-roundtrip.mjs line 94 (`${sensHash}-${OS}`), live-proven run 29613149528
/**
 * Single source of truth for the OS-namespaced Release asset name (CORR-01).
 * BOTH the Phase 3 reader and the Phase 4 publisher MUST derive names through
 * this one helper so save-side and read-side always agree byte-for-byte.
 *
 * LOAD-BEARING, comment-locked (Pitfall 7, D-07). A drift between the two
 * derivations is a SILENT cross-OS MISS -- no error, no crash, just a wave of
 * rebuilds -- which is the exact failure class cacheArchivePath() exists to
 * prevent for @actions/cache. Never inline this, never "tidy" the template, and
 * never change the separator without re-verifying an end-to-end cross-OS read.
 * The exact produced name is pinned by release-asset-name.spec.ts.
 *
 * The platform parameter exists ONLY for test injection -- it lets one CI leg
 * assert all three OS mappings and simulate a wrong-OS reader. It is NOT a mode
 * surface: it cannot influence RW-vs-RO selection (TRUST-05 intact).
 */
export function cachePlatform(platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') {
    return 'windows';
  }

  if (platform === 'darwin') {
    return 'macos';
  }

  return 'linux';
}

export function releaseAssetName(
  hash: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return `${hash}-${cachePlatform(platform)}`;
}
```

### Pattern 3: Degrade-to-MISS at the port boundary (not inside the client)

**What:** One `try/catch` in the backend's `get`, wrapping the entire client call.

**Why here and not in the client:** placing the catch at the port boundary means the
never-throw guarantee holds for an *injected* client too (a fake that throws cannot break the
build), and it keeps the guarantee in exactly one auditable place. It also lets the real client
stay simple -- it may throw freely.

```typescript
// Source: mirrors createReadOnlyMemoryBackend (memory-backend.ts:46-58) + SRV-05
export function createReleasesReadBackend(
  client: ReleaseReadClient,
): CacheBackend {
  return {
    async get(hash: string): Promise<GetResult> {
      try {
        const bytes = await client.fetchAsset(releaseAssetName(hash));

        if (bytes === undefined) {
          return { kind: 'miss' };
        }

        return { kind: 'hit', bytes };
      } catch (error) {
        // D-11 / SRV-05: EVERY fault -- 401/403/404/429, DNS failure, timeout,
        // an injected client that throws -- degrades to MISS. A read fault must
        // never break the build, and must never yield wrong bytes (Pitfall 9).
        warnOnce(error);

        return { kind: 'miss' };
      }
    },

    // D-02: read-only by construction. There is no local write path at all --
    // this is not a disabled feature, it is the absence of one (TRUST-05).
    async put(): Promise<PutResult> {
      return 'forbidden';
    },
  };
}
```

### Anti-Patterns to Avoid

- **Setting `redirect: 'manual'` on the asset download, or re-attaching `Authorization` after the
  redirect.** Native fetch already does the right thing. Re-attaching the header sends the GitHub
  token to a third-party storage origin (a credential leak) and the signed URL will reject the
  duplicate auth anyway.
- **Matching `gh`/`git` stderr text** (`/not logged in/`, `/no oauth token/`). VERIFIED localized;
  breaks for non-English developers. Structural exit-code + stdout only.
- **Switching on `err.code` in the subprocess catch.** It is a `number` for a non-zero exit and the
  string `'ENOENT'` for a missing binary. Catch-all is both simpler and correct.
- **Reading `release.assets` from the release object instead of paginating the assets endpoint.**
  PITFALLS:344 -- the inline array is a non-paginated first-page snapshot, so a near-cap shard reads
  real HITs as MISSes.
- **Falling back to an unauthenticated request when no token resolves.** Forbidden by FOUND-02/D-09.
  Return MISS.
- **Extending `resolveGitHubToken` in place** to add the subprocess tiers. It is env-only by design,
  shared with the CI write path, and pinned by TEST-01 (`select-backend.spec.ts:162-179`).
- **Adding a `mode`/`readOnly`/`client` option to `selectBackend`.** TRUST-05; pinned structurally by
  `selectBackend.length === 0` (`select-backend.spec.ts:183-190`).
- **Logging the resolved token, or echoing helper stderr into the warning.** stderr can carry
  credential-adjacent material and is localized noise.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Following the asset 302 to signed storage | Manual `redirect: 'manual'` + Location parsing + header re-attachment | Default `fetch` redirect handling | Native fetch follows it and drops `Authorization` cross-origin per spec. Hand-rolling it either leaks the token to the storage origin or breaks a working path. |
| Credential discovery | A keychain/`.git-credentials`/`hosts.yml` parser | `gh auth token` + `git credential fill` | These ARE the credential-helper protocols. Parsing `~/.config/gh/hosts.yml` or the Windows Credential Manager directly reimplements them badly and breaks on every storage-backend change. |
| Distinguishing GitHub fault classes | A 401/403-permission/403-secondary/404/429 taxonomy with retry/backoff | One `try/catch` + `res.ok` | D-11 collapses every fault to MISS, so the taxonomy has no consumer. Retry/backoff on a best-effort read path adds latency to a build that should just rebuild. |
| Shell quoting for paths with spaces | `shell: true` + manual quoting | `execFile(..., { shell: false })` | Verified: resolves `C:\Program Files\GitHub CLI\gh.exe` with no quoting and no injection surface. |
| Subprocess promisification | Hand-rolled callback/Promise plumbing | `promisify(execFile)` | One line of stdlib. (`spawn` + stdin is the one exception -- see Code Examples.) |
| Cross-OS key correctness | Per-target portable/non-portable classification | Namespace everything (D-05) | No portability signal exists in the codebase to classify against. Namespacing all entries is correct-by-construction; the cost is per-OS re-caching, which is fully reversible. |

**Key insight:** Almost every "hard" part of this phase is already solved by something that ships in
the box -- fetch's redirect semantics, git's and gh's credential protocols, and the repo's own
single-source-helper pattern. The failure mode of hand-rolling here is uniformly *silent*: a leaked
token, a MISS that reads as an empty cache, or a locale-dependent branch. Reach for the built-in.

## Runtime State Inventory

**Not applicable.** Phase 3 is purely additive greenfield code (three new modules plus a
three-line edit to `select-backend.ts`). It renames nothing, refactors no existing identifier, and
migrates no data.

For completeness, each category checked explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- verified: the phase introduces a READ path only; no datastore is written. The Release assets it reads do not exist yet (the publisher is Phase 4). | none |
| Live service config | None -- verified: no workflow file changes; `ci.yml` is untouched by this phase. | none |
| OS-registered state | None -- verified: no scheduled task, service, or process registration. | none |
| Secrets/env vars | Reads existing `GH_TOKEN`/`GITHUB_TOKEN` (unchanged names, already read by `resolveGitHubToken`). No new secret is created or renamed. A new OPTIONAL env override for repo identity is added (D-10) -- new key, no migration. | none |
| Build artifacts | None -- verified: no `package.json`/lockfile change, so no reinstall is implied. | none |

## Common Pitfalls

### Pitfall 1: stderr-text matching that works in English and silently breaks elsewhere

**What goes wrong:** Code branches on `/no oauth token found/` or `/not logged in/` from `gh`/`git`
stderr to decide "no credential here, try the next tier." On a non-English machine the string never
matches, so the tier is misclassified.
**Why it happens:** It looks robust in local testing -- the developer's machine is usually English,
and the sentinel matches perfectly.
**How to avoid:** Never read stderr. Branch only on process resolution + non-empty trimmed stdout.
**Warning signs:** Any regex applied to a subprocess's stderr; any test that asserts on stderr text.
**Evidence:** VERIFIED 2026-07-19 on this machine -- `git credential fill` against an unresolvable
host emitted Danish stderr ("Der opstod en fejl under afsendelse af anmodningen", "Navnet paa
fjernenheden kunne ikke fortolkes"). An English sentinel matches none of it.

### Pitfall 2: A credential helper that hangs the developer's build

**What goes wrong:** `git credential fill` blocks waiting on an interactive terminal prompt or a GUI
askpass dialog. Nx sits there with no output; the developer kills the build.
**Why it happens:** `git credential fill` is *designed* to prompt when no helper has the credential.
That is correct for interactive git use and catastrophic for a cache lookup on a build's hot path.
**How to avoid:** `GIT_TERMINAL_PROMPT=0`, neutralize `GIT_ASKPASS`/`SSH_ASKPASS`, AND set an
explicit `timeout` on the spawn. All three, not one -- prompt-disabling alone still let git reach
for askpass in the verified probe.
**Warning signs:** A spawn with no `timeout`; env not overridden; the reader working on a machine
with cached credentials but hanging on a fresh one.

### Pitfall 3: `err.code` treated as a number (or as a string)

**What goes wrong:** `if (err.code === 1)` misses the missing-binary case; `if (err.code === 'ENOENT')`
misses the not-logged-in case. Either way one tier stops falling through correctly.
**Why it happens:** The property is genuinely overloaded and nothing in the type system flags it.
**How to avoid:** Catch-all. Every failure has the same meaning to the caller.
**Evidence:** VERIFIED -- bogus-hostname rejection carried `code=1` (number); missing binary carried
`code="ENOENT"` (string).

### Pitfall 4: Reading `release.assets` instead of paginating

**What goes wrong:** Real HITs read as MISSes once a shard exceeds one page.
**Why it happens:** The release object conveniently embeds an `assets` array, so the extra endpoint
looks redundant.
**How to avoid:** Paginate `GET /releases/{id}/assets?per_page=100&page=N` until a short page, exactly
as spike 001 lines 63-86.
**Warning signs:** No `page` parameter in the reader; misses that correlate with shard size.
**Source:** PITFALLS:344 (first-party, empirically established).

### Pitfall 5: Silent single-source drift between reader and Phase 4 publisher

**What goes wrong:** Phase 4's publisher derives `<hash>_<platform>` or `<hash>-<os>` while the
reader derives `<hash>-<platform>`. Every cross-OS read MISSes, with no error anywhere.
**Why it happens:** The publisher is written in a different phase, in a different file, by a
different agent that reimplements an obvious-looking template.
**How to avoid:** The comment-locked helper (Pattern 2) plus a recorded-argument test asserting the
backend passes exactly `releaseAssetName(hash)` to the client -- the `actions-cache-backend.spec.ts`
lines 129-144 discipline.
**Warning signs:** A template literal building an asset name anywhere other than the helper.

### Pitfall 6: Re-attaching Authorization across the redirect (token leak)

**What goes wrong:** The GitHub token is transmitted to `objects.githubusercontent.com`.
**Why it happens:** A developer sees the header "disappear" mid-redirect, assumes a bug, and
"fixes" it with `redirect: 'manual'` plus manual re-attachment.
**How to avoid:** Leave it alone; the drop is the spec-mandated security behavior (whatwg/fetch#1544)
and the signed redirect target carries its own auth.
**Warning signs:** `redirect: 'manual'` in the download path; any header re-attachment after a
`Location` read.

### Pitfall 7: Treating a fault as an authoritative absence outside the read path

**What goes wrong:** The MISS-on-fault rule gets copied into Phase 4's cleanup, where a rate-limited
partial listing then reads as "these assets are orphans, delete them."
**Why it happens:** "Best-effort read degrades to MISS" is repeated so often it over-generalizes.
**How to avoid:** Keep the asymmetry explicit in the comment on `get`: reads may swallow faults;
cleanup and any delete/overwrite decision must fail loud. Phase 3 owns only the read half.
**Source:** PITFALLS Pitfall 8.

## Code Examples

Verified patterns. The `gh`/`git` shapes below were confirmed by direct execution on this machine.

### Auth Tier Contracts (empirically VERIFIED, Node 24.13.0 / win32 / arm64 / gh 2.86.0)

| Call | Condition | Exit | stdout | stderr | Node observation |
|------|-----------|------|--------|--------|------------------|
| `gh auth token` | logged in | 0 | 40-char token matching `^gh[pousr]_[A-Za-z0-9]{20,}$` | EMPTY (0 bytes) | resolves; `stdout.trim().length === 40` |
| `gh auth token --hostname <bad>` | no token for host | 1 | EMPTY | `no oauth token found for ...` (45 bytes) | rejects, `err.code === 1` (number), `err.stdout === ''` |
| `gh` (not installed) | binary absent | -- | -- | -- | rejects, `err.code === 'ENOENT'` (string), `err.errno === -4058` |
| `git credential fill` (stdin `protocol=https\nhost=github.com\n\n`) | credential available | 0 | keys `protocol`, `host`, `username`, `password`; password 40 chars | EMPTY | resolves; parse `password=` |
| `git credential fill` | unresolvable host, `GIT_TERMINAL_PROMPT=0` | 128 | EMPTY | LOCALIZED (Danish here) + `terminal prompts disabled` | fails fast, does not hang |

The decisive structural rule these confirm: **exit 0 AND non-empty trimmed stdout == a credential;
everything else == fall through.** No stderr is consulted in any row.

### Tier 2: `gh auth token`

```typescript
// Source: verified empirically 2026-07-19 (gh 2.86.0, Node 24.13.0 win32/arm64)
async function tokenFromGhCli(): Promise<string | undefined> {
  // Structural contract (VERIFIED): logged in  -> exit 0, token on stdout, stderr empty.
  //                                 no token   -> exit 1 (rejects), stdout empty.
  //                                 gh absent  -> rejects with code 'ENOENT'.
  // A single catch-all covers all failure shapes; err.code is a number for a
  // non-zero exit but the STRING 'ENOENT' when the binary is missing, so it must
  // NOT be switched on. stderr is never read (it is localized -- see Pitfall 1).
  return await tryHelper('gh', ['auth', 'token']);
}
```

### Tier 3: `git credential fill` (needs stdin, so `spawn` not `execFile`)

```typescript
// Source: git-credential docs (key=value lines, blank-line terminated) +
// verified empirically 2026-07-19 -- returned protocol/host/username/password on exit 0.
import { spawn } from 'node:child_process';

async function tokenFromGitCredential(): Promise<string | undefined> {
  const stdout = await new Promise<string>((resolve) => {
    const child = spawn('git', ['credential', 'fill'], {
      shell: false,
      timeout: 5000,
      windowsHide: true,
      // All three are load-bearing (VERIFIED): without prompt-disabling this can
      // block a build forever, and git still reached for git-askpass.exe even
      // with terminal prompts off -- which can pop a modal dialog on a desktop.
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
        SSH_ASKPASS: '',
      },
    });

    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    // stderr is deliberately NOT captured: it is localized (Danish on the probe
    // machine) and may carry credential-adjacent material.
    child.on('error', () => resolve(''));
    child.on('close', (code) => resolve(code === 0 ? out : ''));

    // Request format: key=value lines terminated by a BLANK line.
    child.stdin.end('protocol=https\nhost=github.com\n\n');
  });

  // Response is the same key=value line protocol. Take password structurally.
  const password = /^password=(.*)$/m.exec(stdout)?.[1]?.trim();

  return password || undefined;
}
```

### The three-tier chain (D-08)

```typescript
// Source: D-08. Reuses resolveGitHubToken UNCHANGED -- it is env-only by design,
// shared with the CI write path, and its fallthrough is pinned by TEST-01
// (select-backend.spec.ts:162-179). Do NOT extend it in place.
export async function resolveLocalReadToken(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  // Tier 1: env. `||` inside resolveGitHubToken (not `??`) so a set-but-empty
  // value falls through rather than binding an empty secret (Pitfall 8).
  const fromEnv = resolveGitHubToken(env);

  if (fromEnv) {
    return fromEnv;
  }

  const fromGh = await tokenFromGhCli();

  if (fromGh) {
    return fromGh;
  }

  // Tier 3 is last: it is the slowest and the only one that can touch a keychain.
  // If it also yields nothing we return undefined -- the reader then MISSes.
  // There is deliberately NO anonymous fallback (FOUND-02 / D-09).
  return await tokenFromGitCredential();
}
```

### Repo identity (D-10)

```typescript
// Source: D-10. GITHUB_REPOSITORY is runner-injected and absent locally, so the
// local tier derives identity from the git remote, with the same env var honored
// as an override when present.
const GITHUB_REPOSITORY_PATTERN = /^[^/]+\/[^/]+$/; // reuse select-backend.ts:7

export async function resolveRepoIdentity(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  const override = env.GITHUB_REPOSITORY;

  if (override && GITHUB_REPOSITORY_PATTERN.test(override)) {
    return override;
  }

  const url = await tryHelper('git', ['remote', 'get-url', 'origin']);

  if (url === undefined) {
    return undefined;
  }

  // Handles both remote forms; .git suffix optional:
  //   https://github.com/owner/repo.git
  //   git@github.com:owner/repo.git
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);

  if (match === null) {
    return undefined; // unparseable identity -> reads MISS (D-10), never guess
  }

  return `${match[1]}/${match[2]}`;
}
```

### The REST read sequence + the redirect (D-03)

```typescript
// Source: spike 001 releases-roundtrip.mjs lines 29-116 (byte-identical x3) +
// whatwg/fetch#1544 for the redirect semantics.
const API = 'https://api.github.com';

const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
});

// 1. Resolve the shard release. 404 here is a normal MISS (shard not created yet).
const relRes = await fetch(`${API}/repos/${repo}/releases/tags/${shardTag}`, {
  headers: headers(token),
});

if (!relRes.ok) {
  return undefined; // structural: res.ok / res.status only, never body text
}

const release = await relRes.json();

// 2. PAGINATE the assets endpoint. Do NOT read release.assets -- that inline
// array is a non-paginated FIRST-PAGE snapshot, so a near-cap month shard reads
// real HITs as MISSes (PITFALLS:344).
let asset: { id: number } | undefined;

for (let page = 1; asset === undefined; page++) {
  const listRes = await fetch(
    `${API}/repos/${repo}/releases/${release.id}/assets?per_page=100&page=${page}`,
    { headers: headers(token) },
  );

  if (!listRes.ok) {
    return undefined;
  }

  const batch = await listRes.json();
  asset = batch.find((candidate: { name: string }) => candidate.name === assetName);

  if (batch.length < 100) {
    break; // short page == last page
  }
}

if (asset === undefined) {
  return undefined; // genuine MISS
}

// 3. Download. GitHub answers with a 302 to objects.githubusercontent.com.
// Native fetch AUTO-FOLLOWS it and DROPS the Authorization header on that
// cross-origin hop, per whatwg/fetch#1544 (implemented in undici). That is
// exactly right: the redirect target is a SIGNED url carrying its own auth, and
// forwarding our token to a third-party storage origin would leak it.
// Do NOT set redirect:'manual' and do NOT re-attach the header.
const blobRes = await fetch(`${API}/repos/${repo}/releases/assets/${asset.id}`, {
  headers: {
    authorization: `Bearer ${token}`,
    accept: 'application/octet-stream',
  },
});

if (!blobRes.ok) {
  return undefined;
}

return Buffer.from(await blobRes.arrayBuffer());
```

### The injected client seam (D-04)

```typescript
// Source: D-04 + the repo's TEST-01/02 injected-client convention.
/**
 * The Phase 3 read seam. ONE method on purpose: the seam sits exactly at the
 * OS-namespaced asset NAME, which is the boundary CORR-01/TEST-05 must prove.
 * That makes the TEST-05 fake a plain Map and keeps the REST sequence testable
 * separately by mocking fetch.
 *
 * This is NOT a mode flag (TRUST-05): selectBackend always constructs the reader
 * with the real default client, and no env value or caller argument can swap it.
 */
export interface ReleaseReadClient {
  /** Resolve asset bytes by exact asset name, or undefined when absent. */
  fetchAsset(assetName: string): Promise<Buffer | undefined>;
}

// The TEST-05 fake, in full:
const fake: ReleaseReadClient = {
  fetchAsset: async (name) => seeded.get(name),
};
```

## GitHub Releases Authenticated Fault Matrix

Compiled for the degrade-to-MISS path (D-11). **Every row produces the identical
`{ kind: 'miss' }`** -- this table informs warning quality and nothing else. The planner should
NOT commission a task to branch on these.

| Status | Meaning (authenticated, 5000/hr tier) | Distinguishing signal | Reader action |
|--------|----------------------------------------|-----------------------|---------------|
| 200 | Asset found | -- | HIT |
| 301/302 | Asset download redirect to signed storage | handled automatically by fetch | follow (auto) |
| 401 | Token invalid, expired, or revoked | `res.status === 401` | MISS + warn "credential rejected" |
| 403 (primary rate limit) | Hourly quota exhausted | `x-ratelimit-remaining: 0`; `x-ratelimit-reset` = UTC epoch seconds | MISS + warn |
| 403 (secondary rate limit) | Abuse-protection trip | `x-ratelimit-remaining` NOT 0; body message names a secondary rate limit; `retry-after` MAY be present but is NOT guaranteed | MISS + warn |
| 403 (permission) | Token lacks `contents:read` for this repo | neither of the above signals | MISS + warn |
| 404 (absent) | Shard release or asset genuinely does not exist | -- | MISS (silent; this is the normal cold-cache path, do NOT warn) |
| 404 (hidden private) | Repo exists but is invisible to this token | INDISTINGUISHABLE from absent by design -- GitHub returns 404 rather than 403 so it does not leak existence | MISS |
| 429 | Rate limit (newer responses use this in place of 403) | `retry-after` header when present | MISS + warn |
| 5xx | GitHub outage | `res.status >= 500` | MISS + warn |
| (throw) | DNS failure, TLS error, timeout, offline | `fetch` rejects with a `TypeError` | MISS + warn |

Notes carrying real design weight:

- **404-absent and 404-hidden-private cannot be told apart, and that is intentional.** GitHub hides
  private-resource existence behind 404. Spike 001 confirmed this empirically: an anonymous read of
  the private spike repo returned **404**, not 401. Do not attempt to distinguish; both are MISS.
- **403 vs 429 is not a stable discriminator.** GitHub's own docs state a rate limit yields "403
  Forbidden or 429 Too Many Requests" for BOTH primary and secondary limits. Any code keyed on one
  status will misfire.
- **`retry-after` is not guaranteed on secondary limits** (documented gap, hub4j/github-api#1805),
  which is a further reason not to build retry logic on this path.
- **Do not retry or back off.** MISS is the correct, fast answer: Nx simply rebuilds. Retrying adds
  latency to a build and risks the documented integration ban for hammering a rate limit.

**Warning discipline (D-11):** one-time (a module-level `warned` flag), to stderr, plain ASCII, no
token, no helper stderr echoed, and silent for the ordinary 404-absent case so a cold cache does not
spam every build.

## Cross-OS Regression Guards (TEST-05)

The must-not-reopen invariants, and what to assert so a silent cross-OS MISS is caught. All four are
cheap; the failure mode each guards is invisible without them.

| # | Invariant | Assertion | Failure it catches |
|---|-----------|-----------|--------------------|
| G1 | `.gitattributes` forces LF | Read `.gitattributes` from the repo root; assert it contains `* text=auto eol=lf` | Deleting or weakening the file makes Windows checkouts CRLF, diverging every Nx content hash cross-OS. Currently present and correct (verified). |
| G2 | Asset name has ONE source | Pin the literal produced name (`releaseAssetName('abc123', 'linux') === 'abc123-linux'`) as a STRING LITERAL, not rebuilt from the template | A cosmetic template edit (separator, order, casing) that a reconstructed expectation would still pass. This is precisely the `cache-archive-path.spec.ts:6-13` discipline. |
| G3 | Backend derives names ONLY via the helper | Record the client's `fetchAsset` argument and assert it equals `releaseAssetName(hash)` | The backend inlining its own template, drifting from Phase 4's publisher. Mirrors `actions-cache-backend.spec.ts:129-144`. |
| G4 | Platform mapping is exact | Assert all three branches with literals: `win32 -> windows`, `darwin -> macos`, and a default case (e.g. `linux`, plus one exotic like `freebsd`) mapping to `linux` | A mapping edit that silently re-namespaces the whole store, invalidating every published asset. The injectable platform param is what makes all three assertable from one CI leg. |

**The cross-OS round-trip proper (D-12):** seed the fake client with entries for BOTH platforms and
assert the reader takes its own and never the other's:

```typescript
// TEST-05 core: never a wrong-OS artifact (CORR-01).
// Covers BOTH an OS-invariant and an OS-sensitive hash, per D-12.
const seeded = new Map<string, Buffer>([
  ['deadbeef-linux', Buffer.from('linux-bytes')],
  ['deadbeef-windows', Buffer.from('windows-bytes')],
]);
```

Then, for each platform under test, assert `get('deadbeef')` returns that platform's bytes -- and,
critically, assert the NEGATIVE: a hash seeded ONLY under the other platform's name MUST return
`{ kind: 'miss' }`, never a hit. The negative case is the one that actually proves CORR-01; a
positive-only test passes even if namespacing is removed entirely.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gh` CLI subprocess for REST calls, discriminated by stderr sentinels | Direct REST via native `fetch`, discriminated structurally by `res.status` | This rebuild (ARCHITECTURE-DECISION:9 names the PoC coupling a hazard to fix at the root) | Removes the locale-dependent branch this research empirically confirmed is real. |
| `Authorization` forwarded across redirects | Dropped on cross-origin redirect | whatwg/fetch#1544, implemented in undici and shipped in Node's global fetch | The asset download works with no redirect handling; hand-rolling it is now a regression AND a token leak. |
| Anonymous Releases reads (60 req/hr) | Authenticated reads only (5000/hr), MISS if no credential | FOUND-02 / D-09 | Private repos work; no silent drop to a 60/hr tier that fails under parallel local runs behind one NAT. |
| `node-fetch` / `axios` / `request` | Global `fetch` | Node 18+ (stable in Node 24) | The zero-dep constraint is satisfiable; no HTTP package needed. |

**Deprecated/outdated:**
- Reading `release.assets` inline instead of paginating -- never correct, silently wrong past 100 assets.
- `err.code === 1` as the sole subprocess failure check -- misses `ENOENT` entirely.

## Assumptions Log

Claims NOT verified in this session. Everything else in this document is either VERIFIED by direct
execution on this machine or CITED to a first-party source.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gh auth token` behaves identically on macOS and Linux (probe was Windows-only) | Auth Tier Contracts | LOW. The gh CLI contract is documented and platform-neutral, and the code's catch-all failure handling is agnostic to which failure shape occurs. A difference would degrade to the next tier, not to a wrong result. |
| A2 | `git credential fill` returns the token in `password=` for GitHub across all helpers (probe used Git Credential Manager) | Tier 3 code example | LOW-MEDIUM. Other helpers (osxkeychain, libsecret, store) follow the same documented key-value protocol, but the value could be a real password rather than a token for a user with basic auth configured. GitHub no longer accepts password auth for the API, so such a value would simply produce a 401 -> MISS. Safe failure direction. |
| A3 | The Phase 3 shard tag can be stubbed to a single known location without breaking Phase 4 | REST sequence | LOW. Explicitly sanctioned by CONTEXT deferred-ideas ("may stub the shard-walk to a single known location"). Phase 4 owns `shardTagsForWindow`. |
| A4 | 5-second subprocess timeout is generous enough for a cold keychain unlock | Pattern 1 | LOW-MEDIUM. A locked keychain requiring user interaction would time out and fall through to MISS rather than hang -- the correct safety direction, but a developer with a slow helper could see avoidable misses. Worth making the constant a named export so it is tunable without hunting. |
| A5 | `objects.githubusercontent.com` is the redirect target host | Diagram | LOW. Cosmetic/documentary only -- the code never names the host, since fetch follows the redirect automatically. |

## Open Questions (RESOLVED)

> All three resolved during planning; each recommendation is threaded into an executable PLAN.md
> task (verified by the plan-checker). Retained here as the decision audit trail.

1. **Which shard tag should Phase 3 stub to?**
   - What we know: the month-shard model is `cache-mirror-YYYYMM`; the read-window walk is deferred to Phase 4.
   - What's unclear: whether Phase 3 should stub to the current month (computed) or a fixed constant.
   - Recommendation: compute the CURRENT month (`cache-mirror-` + `YYYYMM`) in one small helper and comment-lock it as the Phase 4 seam. It is the same amount of code as a constant, and it means the reader is already correct for the common case once Phase 4's publisher lands.
   - RESOLVED: current-month `shardTag` stub implemented in Plan 03 Task 1.

2. **Should the env override for repo identity reuse `GITHUB_REPOSITORY` or introduce a dedicated name?**
   - What we know: D-10 requires "a documented env override." `GITHUB_REPOSITORY` is already the repo's vocabulary and already validated by `GITHUB_REPOSITORY_PATTERN` in `select-backend.ts:7`.
   - What's unclear: whether reusing a runner-injected name locally is confusing.
   - Recommendation: reuse `GITHUB_REPOSITORY`. It reuses an existing validated pattern, needs no new documented knob for DOCS-02, and its CI-vs-local meaning is identical (which repo's cache). A dedicated name is a new public-surface entry for no behavioral gain.
   - RESOLVED: `GITHUB_REPOSITORY` reused in Plan 02 Task 2 (no new public-surface knob).

3. **Should the one-time warning be per-process or per-fault-class?**
   - What we know: D-11 says "concise one-time stderr warning."
   - What's unclear: one warning total, or one per distinct fault class.
   - Recommendation: one per process, total. A build that cannot reach the cache should say so once; repeating per fault class re-introduces the log spam the "one-time" wording exists to prevent.
   - RESOLVED: one-warning-per-process rule implemented in Plan 01 Task 2.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (global `fetch`) | All REST calls | yes | v24.13.0 (win32/arm64) | none needed |
| `gh` CLI | Auth tier 2 | yes | 2.86.0 | tier 3 (`git credential fill`), then MISS -- absence is a supported path, not a blocker |
| `git` | Auth tier 3 + repo identity | yes | Git for Windows (clangarm64) | env override for identity; MISS if neither resolves |
| Git Credential Manager | Auth tier 3 backing store | yes | `credential.helper=manager` configured | any other helper, or tier 2, or MISS |
| Network access to api.github.com | Live reads | yes (spikes 001/005 round-tripped) | -- | MISS on failure by construction (D-11) |
| vitest | Specs | yes | workspace-configured | none needed |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none currently missing. Note that `gh` being absent on a
CONSUMER's machine is an expected, fully-handled path (tier 3, then MISS) -- not a degraded state
that needs an install step. The specs must cover it via mocked `ENOENT` rather than assuming `gh` is
present, so CI stays green on a runner without `gh`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (via `@nx/vitest`), workspace-configured |
| Config file | inferred by the Nx plugin; no `project.json` (Phase 1 D-02) |
| Quick run command | `npx nx test github-cache` |
| Full suite command | `npx nx run-many -t test typecheck lint` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORR-01 | `releaseAssetName(hash, platform)` produces exactly `<hash>-<platform>` (pinned literal) | unit | `npx nx test github-cache -- release-asset-name` | GAP Wave 0 |
| CORR-01 | Platform map: `win32->windows`, `darwin->macos`, default (`linux`, `freebsd`)`->linux` | unit | `npx nx test github-cache -- release-asset-name` | GAP Wave 0 |
| CORR-01/TEST-05 | Correct-hit: seeded entry for the reader's own platform returns those exact bytes | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| CORR-01/TEST-05 | **Never-wrong-OS: a hash seeded ONLY under the other platform returns MISS, never a hit** | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| TEST-05 | Cross-OS round-trip covers BOTH an OS-invariant and an OS-sensitive hash (D-12) | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| TEST-05 | G1 guard: `.gitattributes` still contains `* text=auto eol=lf` | unit | `npx nx test github-cache -- cross-os-invariants` | GAP Wave 0 |
| TEST-05 | G3 guard: backend passes exactly `releaseAssetName(hash)` to the client (recorded arg) | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| FOUND-02 | Tier 1 wins: env token short-circuits, no subprocess spawned | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | Tier 1 set-but-EMPTY falls through (`||` not `??`, Pitfall 8) | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | Tier 2 wins when env absent: `gh` exit 0 + stdout token | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | Tier 2 non-zero exit (`err.code === 1`) falls through to tier 3 | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | Tier 2 missing binary (`err.code === 'ENOENT'`) falls through to tier 3 | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | Tier 3 wins: `password=` parsed from key-value stdout | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | Tier 3 declined/empty stdout -> `undefined` (all tiers exhausted) | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | **No-anon guarantee (D-09): with every tier exhausted, `get` MISSes and issues NO unauthenticated request** | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| FOUND-02 | stderr is never consulted: a tier failing with rich stderr but exit 0 + empty stdout still falls through | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | `git credential fill` spawned with `GIT_TERMINAL_PROMPT=0` and a `timeout` (recorded-options assertion) | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | Repo identity parses both `https://` and `git@` remote forms, with/without `.git` | unit | `npx nx test github-cache -- local-context` | GAP Wave 0 |
| FOUND-02 | Unparseable/absent repo identity -> MISS (never a guessed repo) | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| SRV-05/D-11 | Fault -> MISS for EACH branch: 401, 403, 404, 429, 5xx, thrown network error | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| SRV-05/D-11 | An injected client that THROWS still yields MISS (never propagates) | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| SRV-05/D-11 | Warning is emitted at most ONCE per process, and NOT for the ordinary 404-absent path | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| TRUST-05/D-02 | Read-only: `put()` returns `'forbidden'` for every input | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| TRUST-05/D-01 | `selectBackend` local branch returns the Releases reader; `selectBackend.length` stays 0 | unit | `npx nx test github-cache -- select-backend` | exists (extend `select-backend.spec.ts`) |
| D-03 | Asset list is PAGINATED (page 2 is requested when page 1 returns 100) | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |
| D-03 | Download request carries `Accept: application/octet-stream` + bearer, and does NOT set `redirect:'manual'` | unit | `npx nx test github-cache -- releases-backend` | GAP Wave 0 |

### Test Seams

| Seam | Mechanism | Covers |
|------|-----------|--------|
| Injected fake Releases client (D-04) | Plain object implementing `ReleaseReadClient`, backed by a `Map` | All backend behavior: cross-OS hit/miss, put->forbidden, client-throws->MISS. Needs no mocking framework. |
| Injectable platform parameter | `releaseAssetName(hash, platform)` default `process.platform` | All three OS mappings + wrong-OS simulation from a single CI leg. |
| Mocked `node:child_process` | `vi.mock('node:child_process')` -- the `vi.mock` precedent is `actions-cache-backend.spec.ts:17` | Every auth tier outcome (exit 0 / exit 1 / ENOENT / empty stdout / rich stderr) deterministically, with no real `gh`, `git`, keychain, or network. |
| Mocked global `fetch` | `vi.spyOn(globalThis, 'fetch')` returning crafted `Response` objects | The full fault matrix by `res.status`, pagination, and recorded request headers. |
| Injected `env` bag | Existing convention (`select-backend.ts`, `trust.ts` both take `env` with a default) | Tier-1 cases without mutating `process.env` -- `select-backend.spec.ts:102-109` already pins the no-mutation property. |

### Sampling Rate

- **Per task commit:** `npx nx test github-cache`
- **Per wave merge:** `npx nx run-many -t test typecheck lint`
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/release-asset-name.spec.ts` -- covers CORR-01 (pinned literal + platform map, G2/G4)
- [ ] `src/lib/local-context.spec.ts` -- covers FOUND-02 (all tier outcomes; mocked `node:child_process`)
- [ ] `src/backend/releases-backend.spec.ts` -- covers TEST-05 cross-OS, the D-11 fault matrix, put->forbidden, G3
- [ ] `src/lib/cross-os-invariants.spec.ts` -- covers TEST-05 G1 (`.gitattributes eol=lf`); could instead be folded into `release-asset-name.spec.ts` to avoid a fourth file (lazier; planner's call)
- [ ] Extend existing `src/lib/select-backend.spec.ts` -- local branch returns the Releases reader, TRUST-05 unchanged
- Framework install: none needed (vitest already configured)

**Deliberately NOT covered in Phase 3 (deferred, per D-12):** the live-GitHub cross-OS CI matrix
round-trip. It needs the Phase 4 publisher to have written real assets, and was already proven on
paper by spike 005 (run 29613149528, all green).

## Security Domain

`workflow.security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Three-tier credential resolution (D-08). No credential is minted, stored, or transmitted anywhere except `api.github.com` over TLS. No anonymous fallback (D-09). |
| V3 Session Management | no | No sessions; each read is a stateless bearer-authenticated request. |
| V4 Access Control | yes | Read-only by construction (`put -> 'forbidden'`, D-02). RW/RO is context-derived with no caller-facing surface (TRUST-05, structurally pinned by `selectBackend.length === 0`). |
| V5 Input Validation | yes | `{hash}` is already validated `^[a-f0-9]{1,512}$` by the server BEFORE any backend call (SRV-03, Phase 1) -- so the value interpolated into the asset name and URL is a bounded hex string. Repo identity is validated against `GITHUB_REPOSITORY_PATTERN` / a strict remote-URL regex before use. |
| V6 Cryptography | no | No crypto is implemented here. TLS is provided by `fetch`; bearer comparison lives in Phase 1's timing-safe path. Nothing hand-rolled. |
| V7 Error Handling & Logging | yes | Every fault degrades to MISS with a one-time, token-free ASCII warning. Helper stderr is never captured or echoed (it can carry credential-adjacent material and is localized). |
| V12 Files & Resources | yes | Response bytes are buffered; the existing 2 GB server body cap (SRV-04) bounds what the server will serve. Phase 3 writes nothing to disk. |
| V14 Configuration | yes | Subprocesses run `shell: false` with an explicit argv, a bounded timeout, and prompts disabled. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token forwarded to a third-party origin across the asset redirect | Information Disclosure | Rely on fetch's spec-mandated cross-origin `Authorization` drop; forbid `redirect:'manual'` + re-attachment (Anti-Patterns). |
| Command injection via a crafted hash or remote URL reaching a shell | Tampering / EoP | `execFile`/`spawn` with `shell: false` and an explicit argv array -- never string interpolation into a command line. Hash is already SRV-03-validated hex. |
| Token leaked into logs, warnings, or the Nx build output | Information Disclosure | Never log the resolved token; never echo helper stderr; warning text is a fixed ASCII string. |
| A read fault silently treated as authoritative absence in a DESTRUCTIVE context | Tampering | Comment-lock the asymmetry on `get`: reads may swallow faults, but Phase 4's cleanup/delete must fail loud (PITFALLS Pitfall 8). Phase 3 owns only the read half. |
| Wrong-OS artifact served as a valid hit (a wrong RESULT, not a MISS) | Tampering / Core-Value violation | OS-namespacing every entry (CORR-01) + the negative never-wrong-OS assertion, which is the test that actually proves it. |
| Silent downgrade to the anonymous 60/hr tier for a private repo | Information Disclosure / DoS | D-09: no anonymous fallback. MISS instead. Test-covered by the no-anon guarantee row. |
| A hung credential helper wedging the developer's build | DoS | Explicit spawn `timeout` + `GIT_TERMINAL_PROMPT=0` + neutralized askpass. |
| Malicious/poisoned cache content served to a developer | Tampering (CREEP) | OUT OF SCOPE for Phase 3 by design: CREEP is defended at the Phase 4/5 write and sync gates (C1/C2/C5), not the reader. The reader is read-only and cannot widen the write trust boundary. |

**No BLOCKER-severity (high+) findings identified for this phase.** The phase adds no write path, no
new dependency, and no new network-reachable surface; its two genuinely security-relevant behaviors
(credential handling and the redirect) both have first-party-verified correct-by-default answers.

## Sources

### Primary (HIGH confidence)

- **Direct empirical probe, this machine, 2026-07-19** -- Node 24.13.0 / win32 / arm64 / gh 2.86.0 / Git for Windows with `credential.helper=manager`. Established: `execFile` PATH+`.exe` resolution without a shell; exit-0/stdout contract for `gh auth token`; `err.code` numeric-vs-`'ENOENT'` overload; `git credential fill` request/response key-value protocol and the `password=` field; `GIT_TERMINAL_PROMPT=0` fail-fast behavior; askpass still being attempted; and the LOCALIZED (Danish) failure stderr.
- `.planning/spikes/001-reader-round-trip/` (README + `releases-roundtrip.mjs`) -- exact REST sequence, per_page=100 pagination loop, `Accept: application/octet-stream` download, byte-identical round-trip x3, anon-blocked-404 on a private repo.
- `.planning/spikes/005-cross-os-roundtrip/` (README + `ci-roundtrip.mjs`) -- `${hash}-${OS}` namespacing (line 94), the `process.platform` OS map (line 16), live matrix proof (run 29613149528), and the store-agnostic wrong-OS hazard demo.
- `.planning/research/PITFALLS.md` -- Pitfall 7 (cross-OS must-not-reopen), Pitfall 8 (fault-as-absence; `||` not `??`), Pitfall 9 (MISS-not-wrong-result), the `gh`-stderr technical-debt row (line 233), and the Releases inline-`assets` first-page-snapshot fact (line 344).
- `.planning/ARCHITECTURE-DECISION.md` -- Decision 1 (one backend per process, no flag), Decision 3 (Releases reader + read-time integrity), Decision 6 (cross-OS OS-namespacing).
- In-repo source read directly: `select-backend.ts`, `backend/types.ts`, `memory-backend.ts`, `actions-cache-backend.ts(+spec)`, `cache-archive-path.ts(+spec)`, `serve.ts`, `trust.ts`, `.gitattributes`.
- [Rate limits for the REST API - GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) -- 403-or-429 for both primary and secondary limits; `x-ratelimit-remaining`/`-reset`/`-used`/`-resource`; `retry-after` precedence.
- [git-credential documentation](https://git-scm.com/docs/git-credential) -- the key=value line protocol, blank-line termination, and the `fill` input/output attribute sets.
- [Remove Authorization header upon cross-origin redirect (whatwg/fetch#1544)](https://github.com/whatwg/fetch/pull/1544) -- the spec change native fetch implements.

### Secondary (MEDIUM confidence)

- [Troubleshooting the REST API - GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) and [Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) -- secondary-limit detection guidance and the ban warning for hammering a rate limit.
- [undici advisory GHSA-3787-6prv-h9w3](https://github.com/nodejs/undici/security/advisories/GHSA-3787-6prv-h9w3) and [GHSA-wqq4-5wpv-mx2g](https://github.com/nodejs/undici/security/advisories/GHSA-wqq4-5wpv-mx2g) -- both state that undici already cleared `Authorization` on cross-origin redirects, corroborating the behavior from the implementation side.
- [hub4j/github-api#1805](https://github.com/hub4j/github-api/issues/1805) -- `Retry-After` is not always sent for secondary rate limits.

### Tertiary (LOW confidence)

- [cli/cli#8845](https://github.com/cli/cli/issues/8845), [cli/cli#7447](https://github.com/cli/cli/issues/7447) -- historical `gh auth status` exit-code and stdout/stderr inconsistencies. Cited only as background motivating the "verify, do not assume" approach; the actual `gh auth token` contract used here was measured directly, not taken from these.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- zero new packages; every primitive is stdlib or a built-in, and the exact runtime version was confirmed by execution.
- Auth tier contracts: HIGH -- measured directly on the target OS/arch/runtime, including the failure and missing-binary shapes.
- Redirect/`Authorization` behavior: HIGH -- spec change + undici advisories + spike 001's working round-trip all agree.
- Fault matrix: HIGH for the mapping (all faults -> MISS, which is what the code needs); MEDIUM for the fine-grained 403-primary vs 403-secondary distinction, which GitHub itself documents as non-deterministic across 403/429. This uncertainty is harmless: nothing branches on it.
- Cross-OS guards: HIGH -- derived from first-party PITFALLS plus the live spike 005 matrix, and modeled on guard tests already in this repo.
- Architecture patterns: HIGH -- every pattern has an in-repo precedent to copy (`cache-archive-path.ts`, `memory-backend.ts`, `actions-cache-backend.spec.ts`), except the subprocess wrapper, which is established here from measured behavior.

**Research date:** 2026-07-19
**Valid until:** 2026-08-18 (30 days). The stable facts (fetch redirect semantics, git credential protocol, the repo's own patterns) are effectively permanent; the `gh` CLI contract and GitHub's 403-vs-429 rate-limit surface are the only pieces worth re-checking, and neither is load-bearing because every outcome degrades to MISS.
