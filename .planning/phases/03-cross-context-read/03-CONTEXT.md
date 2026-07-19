# Phase 3: Cross-Context Read - Context

**Gathered:** 2026-07-19 (assumptions mode: --analyze --auto)
**Status:** Ready for planning

<domain>
## Phase Boundary

A developer on any OS reads this repo's CI-produced cache locally through the GitHub
Releases reader using their existing GitHub auth, and a cross-OS hit never serves a
wrong-OS artifact. Mode: MVP.

Delivers requirements FOUND-02 (local auth), CORR-01 (OS-namespacing), TEST-05 (cross-OS
round-trip guard).

IN SCOPE: the read-only GitHub Releases backend behind `selectBackend`'s local branch;
the OS-namespaced asset-name scheme (single-source helper); the full local auth chain;
degrade-to-MISS fault handling; the injected-client cross-OS round-trip test.

OUT OF SCOPE (Phase 4+): the real publisher/sync engine that writes to Releases; the
retention-window month-shard walk; a live-GitHub CI matrix round-trip; any local write
path (read-only by construction).

</domain>

<decisions>
## Implementation Decisions

### Reader Backend & Integration
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

### OS-Namespacing (CORR-01)
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

### Auth & Repo Identity (FOUND-02)
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

### Degradation (SC4 / SRV-05)
- **D-11:** Every read fault - missing asset (404), auth failure (401/403), rate limit (429),
  network error - is caught and returned as `{ kind: 'miss' }`, never thrown. Fault
  discrimination is STRUCTURAL (`res.status`), never stderr/text matching. Degradation emits a
  concise one-time stderr warning (build-friendly); workflow annotations are Phase 4 (OBS-01).

### TEST-05 Strategy
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` (Phase 3 section; Phase 4 dependency note; traceability)
- `.planning/ARCHITECTURE-DECISION.md` (Decision 1 one-backend-per-process/no-flag; Decision 3
  Releases reader + read-time integrity; Decision 6 cross-OS OS-namespacing)
- `.planning/REQUIREMENTS.md` (FOUND-02 line 11, TEST-05 line 34, CORR-01 line 57, TRUST-07 line 54)
- `packages/github-cache/src/lib/select-backend.ts` (Phase 3 placeholder lines 40-42;
  `resolveGitHubToken` lines 20-24; repo-identity validation lines 45-52)
- `packages/github-cache/src/lib/select-backend.spec.ts` (injected-env test pattern; TEST-01 pins
  on `resolveGitHubToken` lines 162-179; TRUST-05 no-mode-surface lines 182-214)
- `packages/github-cache/src/backend/types.ts` (`CacheBackend` port)
- `packages/github-cache/src/backend/memory-backend.ts` (`createReadOnlyMemoryBackend` lines 46-58
  - the 403 read-only analog)
- `packages/github-cache/src/backend/actions-cache-backend.ts` + `.spec.ts` (module-mock test
  pattern; single-source path helper usage; fault->MISS shape)
- `packages/github-cache/src/lib/cache-archive-path.ts` (comment-locked single-source helper
  template for the new OS+hash asset-name helper)
- `.planning/spikes/001-reader-round-trip/README.md` + `releases-roundtrip.mjs` (authenticated
  private read; exact REST call sequence; anon-blocked proof)
- `.planning/spikes/005-cross-os-roundtrip/README.md` + `ci-roundtrip.mjs` (OS-namespacing
  `${hash}-${OS}` pattern line 94; store-agnostic wrong-OS hazard; already-proven live matrix)
- `.planning/research/PITFALLS.md` (Pitfall 8 `||` not `??`; Pitfall 9 MISS-not-wrong-result;
  rate-limit->MISS; no `gh` stderr matching)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `selectBackend` + `resolveGitHubToken` (`select-backend.ts`) - the single decision point and
  the env-tier token resolver to reuse (not extend).
- `CacheBackend` port (`backend/types.ts`) - the reader's contract.
- `createReadOnlyMemoryBackend` (`memory-backend.ts:46-58`) - the read-only (`put -> forbidden`)
  analog to mirror.
- `cacheArchivePath` (`cache-archive-path.ts`) - the comment-locked single-source helper template.
- Injected/mocked-client test pattern (`actions-cache-backend.spec.ts` `vi.mock`,
  `select-backend.spec.ts`) - the TEST-05 harness style.

### Established Patterns
- Single-context `selectBackend` decision; RW/RO by factory, never a mode flag (TRUST-05).
- Single-source comment-locked path/name helpers (D-03); silent-MISS is the failure mode.
- Injected/mocked clients in tests, never live network.
- `||` not `??` for token coalescing (Pitfall 8 - a set-but-empty value falls through).
- Best-effort read: fault -> MISS, never a 5xx that breaks the build (SRV-05).
- TDD mandatory (`workflow.tdd_mode: true`).

### Integration Points
- Replace the placeholder in `select-backend.ts:40-42` with the Releases reader construction.
- New read-only Releases backend module under `src/backend/`.
- New OS+hash asset-name helper under `src/lib/`.
- New local-context auth resolver (`resolveLocalReadToken`) + `git remote origin` repo-identity
  resolution.

</code_context>

<specifics>
## Specific Ideas

- Spikes 001 (reader round-trip) and 005 (cross-OS round-trip) are the reference implementations:
  the REST call sequence (D-03) and the `${hash}-${OS}` namespacing (D-05/D-06) come from them.

- **Research pointers for the planner (gsd-phase-researcher):**
  1. Exact `gh auth token` and `git credential fill` invocation + failure modes on Windows
     (not-installed / not-logged-in / non-zero exit; `.exe`/`.cmd` resolution, no shell) - the
     repo currently spawns no subprocesses, so there is no in-repo precedent. Structural stdout
     parsing only; never stderr.
  2. GitHub Releases authenticated fault-response matrix for the degrade-to-MISS path: 403
     permission vs secondary-rate-limit, 404 missing-asset vs hidden-private, 429 /
     `X-RateLimit-Remaining` / `Retry-After` under the authenticated 5000/hr tier. Spike 001
     proved only 200 + anon-404; the fault branches need concrete shapes to discriminate
     structurally.

</specifics>

<deferred>
## Deferred Ideas

- Real live-GitHub cross-OS CI matrix round-trip (the TEST-05 "live" variant) -> Phase 4 (needs
  the publisher). Already proven on paper by spike 005.
- Month-shard read-WINDOW walk (`shardTagsForWindow`, coupled to the `CACHE_MIRROR_MAX_AGE_DAYS`
  retention knob) -> settle in Phase 4. Phase 3 owns only the OS-namespaced asset-NAME scheme and
  may stub the shard-walk to a single known location.
- OS-invariant cross-OS sharing (relax namespacing for classified-portable targets) -> later
  optimization; additive, no consumer-contract impact.
- Octokit convergence for the read path -> Phase 4 consistency note if the publisher standardizes
  on Octokit.

</deferred>
