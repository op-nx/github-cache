---
phase: 03-cross-context-read
plan: 02
subsystem: auth
tags: [auth, github, subprocess, spawn, gh-cli, git-credential, credential-chain, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-default-cache-in-ci
    provides: resolveGitHubToken (env-only token tier, || not ??) + GITHUB_REPOSITORY_PATTERN + selectBackend decision point (select-backend.ts)
  - phase: 03-cross-context-read
    provides: "03-01 releaseAssetName + createReleasesReadBackend + ReleaseReadClient seam (the read core this auth layer will feed in 03-03)"
provides:
  - "resolveLocalReadToken(env?) - the D-08 three-tier local read token chain: env (delegated to resolveGitHubToken) -> gh auth token -> git credential fill, exhausted -> undefined (no anonymous fallback, D-09)"
  - "resolveRepoIdentity(env?) - D-10 local repo identity: GITHUB_REPOSITORY override (shape-validated) else git remote origin parsed for https + scp-like ssh, unparseable -> undefined (never a guess)"
  - "HELPER_TIMEOUT_MS (5000, exported) + one hardened spawn wrapper (runHelper) all local helpers route through"
  - "GITHUB_REPOSITORY_PATTERN now exported from select-backend.ts (was module-private)"
affects: [03-03-wire-reader-into-selectbackend, phase-4-publisher, cross-context-read]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One hardened spawn wrapper for local credential/context helpers: shell false + bounded timeout + windowsHide + GIT_TERMINAL_PROMPT=0 + neutralised GIT_ASKPASS/SSH_ASKPASS, all over a COPY of process.env"
    - "Structural-only subprocess discrimination: clean exit (code 0) + non-empty trimmed stdout; no stderr listener attached at all (stderr is localized + credential-adjacent); error code never inspected (overloaded number/ENOENT-string)"
    - "Explicit-factory node:child_process mock with a microtask-driven fake child (EventEmitter stdout/stderr, recording stdin, captured error/close listeners) - the repo's first subprocess mock"
    - "Credential fallbacks coalesce with || never ?? (Pitfall 8), extended to subprocess stdout via stdout.trim() || undefined"

key-files:
  created:
    - packages/github-cache/src/lib/local-context.ts
    - packages/github-cache/src/lib/local-context.spec.ts
  modified:
    - packages/github-cache/src/lib/select-backend.ts

key-decisions:
  - "runHelper consolidates ALL three subprocess call sites on spawn (not execFile for two + spawn for one): git credential fill needs stdin regardless, so one mechanism means one hardening surface and one mock shape at no cost (deliberate consolidation of RESEARCH Pattern 1's two-mechanism sketch; the four load-bearing options are identical either way)"
  - "Structural discrimination only - no stderr listener attached: helper failure stderr is LOCALIZED (Danish on the probe machine) and credential-adjacent; the error code is never switched on (number for a non-zero exit, string 'ENOENT' for a missing binary)"
  - "GITHUB_REPOSITORY_PATTERN exported from select-backend.ts (one keyword, 1-line diff) and reused rather than duplicated; resolveGitHubToken body left byte-identical so TEST-01 is unaffected"
  - "FOUND-02 requirement checkbox deferred to 03-03 (the end-to-end wiring into selectBackend), mirroring how CORR-01 was left unchecked after plan 01"

patterns-established:
  - "Hardened local-helper spawn wrapper (Pattern 1 from 03-RESEARCH, consolidated on spawn) - the repo's first node:child_process usage"
  - "Microtask-driven fake-child module mock for node:child_process - the repo's first subprocess mock, justified in an actions-cache-backend.spec.ts-style register"

requirements-completed: []

coverage:
  - id: D1
    description: "HELPER_TIMEOUT_MS (5000, exported) plus one module-private runHelper spawn wrapper: shell false, bounded numeric timeout, windowsHide, GIT_TERMINAL_PROMPT=0 and neutralised GIT_ASKPASS/SSH_ASKPASS over a copy of process.env; stdout-only structural discrimination, no stderr listener, error code never inspected"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/local-context.spec.ts#spawns git credential fill hardened: shell false, bounded numeric timeout, windowsHide, prompts and askpass neutralised (FOUND-02, T-03-10)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/local-context.spec.ts#tier 2 exit 0 with rich stderr but EMPTY stdout falls through -- stderr is never consulted (FOUND-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveLocalReadToken three-tier chain (env -> gh auth token -> git credential fill), each tier's win/fallthrough/exhaustion covered; every tier exhausted -> undefined with no anonymous fallback and no third spawn (D-08, D-09)"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/local-context.spec.ts#resolveLocalReadToken three-tier chain (FOUND-02) [12 cases: tier1 short-circuit, set-but-empty fallthrough, tier2 win, non-zero/ENOENT/empty-stdout fallthrough, tier3 win, no-password exhaustion, exhausted+no-anon, hardened spawn, blank-line stdin, no env mutation]"
        status: pass
    human_judgment: false
  - id: D3
    description: "resolveRepoIdentity: shape-validated GITHUB_REPOSITORY override wins with zero spawns; else git remote origin parsed by one anchored regex for https + scp-like ssh with optional .git; non-GitHub host / non-zero exit / ENOENT / unparseable -> undefined, never a guess (D-10)"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/local-context.spec.ts#resolveRepoIdentity origin remote and env override (FOUND-02) [9 cases: override win + zero spawn, malformed override ignored, https with/without .git, scp-like ssh, non-GitHub -> undefined, non-zero + ENOENT -> undefined, no env mutation]"
        status: pass
    human_judgment: false
  - id: D4
    description: "GITHUB_REPOSITORY_PATTERN exported from select-backend.ts and reused (not duplicated); resolveGitHubToken body byte-identical so the CI write path and TEST-01 are unaffected"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "npx nx test github-cache -- select-backend (TEST-01 suite, 4 resolveGitHubToken fallthrough cases still green)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-07-19
status: complete
---

# Phase 3 Plan 02: Cross-Context Read (local auth + repo identity core) Summary

**Three-tier local read token chain (env -> gh auth token -> git credential fill) and origin-remote repo identity, both resolved through one hardened, injection-safe, prompt-proof spawn wrapper and both degrading to undefined -- never to an anonymous request or a guessed repo.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-19T17:56:05Z
- **Completed:** 2026-07-19T18:06:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 2 created, 1 modified

## Accomplishments
- `resolveLocalReadToken(env?)` - the FOUND-02 core: tier 1 delegates to the UNCHANGED `resolveGitHubToken` (env-only, shared with the CI write path, pinned by TEST-01), tier 2 is `gh auth token`, tier 3 is `git credential fill` parsed structurally for the `password=` field. Every tier exhausted resolves `undefined` -- there is no anonymous fallback anywhere in the chain (D-09), so a private-repo read never silently drops to the 60/hr tier.
- `resolveRepoIdentity(env?)` - a shape-validated `GITHUB_REPOSITORY` override wins with zero spawns, else the origin remote is parsed by one anchored regex handling both the https and the scp-like ssh forms with an optional `.git`. A non-GitHub host or an unparseable/absent identity resolves `undefined` -- never a guessed repository (D-10, the fail-closed hazard `select-backend.ts` already guards on the write side).
- One module-private `runHelper` spawn wrapper all three call sites route through: `shell: false` (injection-safe explicit argv), a bounded `HELPER_TIMEOUT_MS` (5000, exported), `windowsHide`, and an env spreading a COPY of `process.env` with `GIT_TERMINAL_PROMPT=0` plus neutralised `GIT_ASKPASS`/`SSH_ASKPASS` -- all three keys together, so no credential helper can wedge the build on a modal/askpass.
- Structural discrimination ONLY: a clean exit (code 0) plus non-empty trimmed stdout. No stderr listener is attached at all (stderr is localized -- Danish on the probe machine -- and credential-adjacent), and the child error code is never inspected (it is a number for a non-zero exit and the string `ENOENT` for a missing binary).
- 21 new specs (12 token-chain + 9 repo-identity), driven by an explicit-factory `node:child_process` mock with a microtask-driven fake child -- the repo's first subprocess mock. The suite invokes no real `gh`/`git`, so it passes on a machine with no gh CLI installed.

## Task Commits

Each task was committed atomically (TDD: RED failing test -> GREEN implementation):

1. **Task 1: Hardened spawn wrapper + three-tier read token chain**
   - `a4eff14` (test - RED: failing local-context.spec.ts, 12 token-chain cases)
   - `178a91b` (feat - GREEN: HELPER_TIMEOUT_MS + runHelper + resolveLocalReadToken, 12 green)
2. **Task 2: Local repo identity from the origin remote**
   - `f12a517` (test - RED: 9 resolveRepoIdentity cases fail, 12 tier tests stay green)
   - `5545cad` (feat - GREEN: export GITHUB_REPOSITORY_PATTERN + resolveRepoIdentity, 21 green)

**Plan metadata:** committed separately (docs: complete plan).

_No REFACTOR commits: both implementations were minimal (one wrapper + two resolvers) and needed no cleanup._

## Files Created/Modified
- `packages/github-cache/src/lib/local-context.ts` - `HELPER_TIMEOUT_MS`, the hardened `runHelper` spawn wrapper (four load-bearing options each with an inline reason; no stderr listener; `|| undefined` coalescing), `resolveLocalReadToken` (D-08 three tiers, no anonymous fallback), and `resolveRepoIdentity` (D-10 override-then-remote, never a guess).
- `packages/github-cache/src/lib/local-context.spec.ts` - explicit-factory `node:child_process` mock; a `fakeChild` (EventEmitter stdout/stderr, recording stdin, captured error/close listeners driven on the next microtask); 21 specs across two `(FOUND-02)` describe blocks, each guard carrying a `Non-vacuous` note where the failure mode is subtle.
- `packages/github-cache/src/lib/select-backend.ts` - added the single `export` keyword to `GITHUB_REPOSITORY_PATTERN` (1-line diff; `resolveGitHubToken` body byte-identical).

## Decisions Made
- **One spawn mechanism for all three call sites** (not `execFile` for two + `spawn` for the stdin one). `git credential fill` needs stdin regardless, so consolidating on `spawn` means one hardening surface and one mock shape at no cost. This is a deliberate consolidation of 03-RESEARCH Pattern 1's two-mechanism sketch; the four load-bearing options are identical either way. Marked with a `ponytail:` comment.
- **No stderr listener, structural discrimination only.** Helper failure stderr is LOCALIZED (Danish on the probe machine per 03-RESEARCH) and can carry credential-adjacent material, so any stderr sentinel silently misfires for non-English developers. The error code is never switched on (overloaded: number for a non-zero exit, string `ENOENT` for a missing binary) -- every failure means the same thing: this tier yielded nothing.
- **Export, do not duplicate, `GITHUB_REPOSITORY_PATTERN`.** One keyword is a smaller diff than a second copy of the owner/name shape, no spec asserts on it, and `resolveGitHubToken` stays byte-identical so TEST-01 and the CI write path are untouched.
- **FOUND-02 checkbox deferred to 03-03.** This plan delivers the FOUND-02 auth/identity mechanism and its full test matrix, but the end-to-end requirement ("local read uses the developer's existing GitHub auth and reads a private-repo entry back") is only true once 03-03 wires these resolvers into `selectBackend`'s local branch. The checkbox is left `[ ]` for 03-03, exactly as CORR-01 was left unchecked after plan 01 delivered its helper.

## Deviations from Plan

None - plan executed exactly as written. (The consolidation of the two subprocess mechanisms onto a single `spawn` wrapper was explicitly directed by the plan's `<action>`, not an unplanned deviation.)

## Issues Encountered
- **`nx format:check --projects=github-cache` errors** ("Cannot read properties of undefined (reading 'data')") - that flag combination is unsupported; `nx format:check` takes `--files`/`--all`, not `--projects`. Verified formatting the authoritative way instead: `npx prettier --check` on all three touched files reports "All matched files use Prettier code style" (same discipline plan 01 used).
- **No `lint` target** for `@op-nx/github-cache` (targets: typecheck, build, build-deps, watch-deps, test), as plan 01 recorded. The acceptance-criteria `run-many -t typecheck lint` command no-ops the absent `lint` and runs `typecheck` green; `test` + `typecheck` are the authoritative signals and both pass.

## Verification
- `npx nx test github-cache` - 142 passing (13 files), including the 21 new local-context specs; +21 over plan 01's 121, no existing spec regressed.
- `npx nx run-many -t test typecheck --projects=github-cache` - green.
- `npx nx build github-cache` - green.
- `npx prettier --check` on the 3 touched files - clean.
- Source gates (all on `local-context.ts`, non-comment lines only): `stderr` count 0, `shell: false` count 1, `shell: true` count 0, `??` count 0, `GIT_TERMINAL_PROMPT` present, both askpass vars present, `GITHUB_REPOSITORY_PATTERN` reused (count 2: import + use).
- `git diff --stat select-backend.ts` - exactly 1 changed line; `resolveGitHubToken` body byte-identical (only the `export` keyword added).
- Zero dependency change: `package.json` / `package-lock.json` untouched across all four commits.
- Machine-independent: the spec mocks `node:child_process` entirely, so no real `gh`/`git` binary is spawned (passes on a runner with no gh CLI).

## User Setup Required
None - no external service configuration required. This plan is dependency-free and unit-tested with a fully mocked subprocess layer. The real token/repo-identity resolution runs against the developer's actual `gh`/`git` only once 03-03 wires these resolvers into the default Releases client.

## Next Phase Readiness
- The FOUND-02 auth/identity core is complete and fully covered: `resolveLocalReadToken` and `resolveRepoIdentity` are ready for 03-03 to call from inside the default `ReleaseReadClient.fetchAsset`.
- **03-03 watch-outs:** both resolvers are async; `selectBackend` must stay synchronous (`Function.length === 0`, `serve.ts:82`), so resolution belongs inside `fetchAsset`, never at construction. When either resolver returns `undefined`, 03-03 must return `undefined` before issuing any fetch (D-09 no anonymous request). 03-03 then marks the FOUND-02 (and CORR-01) requirement checkboxes once the end-to-end private-repo read is wired.

## Self-Check: PASSED
- Files: all 3 source/spec files + the SUMMARY FOUND on disk.
- Commits: a4eff14, 178a91b, f12a517, 5545cad all FOUND in git history.

---
*Phase: 03-cross-context-read*
*Completed: 2026-07-19*
