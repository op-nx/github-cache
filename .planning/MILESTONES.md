# Milestones

## v0.0.2 OS-invariant cross-OS sharing (Shipped: 2026-08-11)

**Phases completed:** 7 phases (7-13), 45 plans, 110 tasks

**Delivered:** The cache store became OS-invariant on both layers, and all four cross-OS
reuse outcomes (O1-O4) were proven on real runners in the mandated order -- then shipped as a
safe-by-default recipe an outside project can copy.

**Stats:** 664 commits over 20 days (2026-07-22 -> 2026-08-11). 80 source/config files changed
(+25,161 / -1,047), excluding `.planning/`. 1,145 tests across 44 files green at close.
57/57 requirements complete. All 7 phases verified `passed`.

**Key accomplishments:**

- **The OS discriminator moved out of the store and into the declared Nx input** (D2-01,
  superseding CORR-01's OS-namespacing branch). Both layers went OS-invariant in the same
  milestone: the `@actions/cache` version via one hardcoded forward-slash archive-path literal
  plus `enableCrossOsArchive` at all three call sites (Phase 9), and the Releases mirror via a
  single `nx-cache-<hash>` asset name whose cleanup filter admits the legacy family in the same
  commit so nothing silently stops pruning (Phase 10).

- **The cross-OS Nx task-hash divergence was root-caused to one field before it was fixed.**
  Four readings at one commit isolated `targets.typecheck.outputs` -- seven entries on Linux,
  one on Windows -- as the entire divergence on both the OS axis AND the staleness axis that
  had been masquerading as it. One `nx.json` key collapsed it to zero differing nodes, and a
  build-gating two-leg CI job now enforces the comparison every run rather than once, proven
  RED on real runner data for both halves of the gate and GREEN again on the revert (Phase 8).

- **All four target outcomes proven live, in the order that makes O1's evidence possible at
  all.** From a cold `.nx/cache`, a native Windows arm64 workstation logged `[remote cache]`
  for all four targets against Linux-CI-produced artifacts, with per-hash producer attribution
  captured at the last commit before anything rotated -- the record that enabling O4 destroys
  permanently. O3 was proven as an Nx-hash property with a positive control in the same job,
  not as a storage probe (Phase 11). O4 followed on three new windows-11-arm legs wired
  `needs:` their ubuntu counterparts (Phase 12).

- **The Windows reuse gate was made unlaunderable rather than merely present.** A read-only
  Actions-cache backend -- `createActionsCacheBackend()` is now
  `{ ...createReadOnlyActionsCacheBackend(), put }`, so exactly one `restoreCache` call site
  survives and cache-version drift is unrepresentable rather than guarded -- lets the three
  Windows legs decline the write. A leg that cannot save can only earn a `[remote cache]`
  label by genuinely restoring the ubuntu producer's entry, so the count is soundly gateable
  (Phase 13).

- **"Unit specs must not read the running machine" became a build failure instead of a
  convention.** ESLint 9 flat config and a `lint` target were adopted first, for a hashing
  reason rather than a tidiness one -- `@nx/eslint` is an inference plugin, so adopting it
  after the parity work would have invalidated it. The ban is proven RED against every extant
  violation before those violations are removed downstream, and stale disable directives fail
  rather than pre-authorising a future violation (Phase 7).

- **Incident-response attribution survived the namespace collapse.** `mirrored-by: <os>` moved
  into the Release asset's free-form `label`, outside the lookup name, and is comment-locked so
  it can never be misread as naming the producing OS -- precisely the identity Phase 9 breaks.
  The trust consequences of collapsing two namespaces into one were classified by an
  independent security auditor rather than assumed away (Phase 10).

- **A consumer-facing cross-OS recipe that leads with the safe default** (`docs/cross-os.md`):
  declare the platform discriminator across all cacheable targets first, then earn a removal
  per target against a portability checklist derived from the Phase 8 root-cause findings. It
  names architecture and libc as axes `process.platform` does not cover, and states plainly
  that this repo cannot exercise them (Phase 12).

**Known tech debt carried forward** (from `milestones/v0.0.2-MILESTONE-AUDIT.md`, status
`tech_debt`, 0 requirement/integration/flow gaps):

- One unattributed `test` failure at `69bd1b7`, not reproducible in 7 attempts and with no
  output captured. **A SECOND occurrence landed during this milestone close, and the capture
  procedure in `AGENTS.md` worked**: the failure is a vitest worker fork exiting with no
  assertion error, localised to `src/serve.spec.ts`, and again not reproducible on an uncached
  re-run. Full capture in `.planning/debug/vitest-worker-crash-serve-spec.md`. Not a v0.0.2
  gap -- every gate was green at close.
- Four stale-prose items behind the shipped tree (`11-EVIDENCE.md`'s O4 verdict slot,
  `codebase/INTEGRATIONS.md`'s four-outcome `selectBackend` count, and two sealed VERIFICATION
  notes). All are documented as superseded; none contradicts code.
- SUMMARY `requirements_completed` frontmatter is absent for 34 of 57 requirements, so the
  audit's third cross-reference source is structurally non-discriminating on this project. All
  34 were verified manually against their phase VERIFICATION.md coverage tables instead.
- Nine `/simplify` items deliberately deferred to v0.0.3 (`b6580ad`) -- recorded so the lane is
  not lost, not counted as v0.0.2 debt.
---

## v0.0.1 Greenfield MVP Rebuild (Shipped: 2026-07-22)

**Phases completed:** 7 phases, 33 plans, 63 tasks

**Key accomplishments:**

- Removed the @op-nx/github-cache spike/PoC project and its 3 non-graph siblings via nx g @nx/workspace:remove, scrubbed the dangling nx.json/package.json residue, and rebuilt package-lock.json - leaving a shell-only Nx workspace (@op-nx/source only) that resolves with zero dangling references and passes npm ci, with the D-03 dormant cross-OS invariants preserved.
- Deleted mirror-cleanup.yml and reworked ci.yml into a 5-job (format-check, build, typecheck, test, ubuntu+windows integration matrix) local-cache-only workflow with least-privilege `contents: read` permissions.
- Scoped nx format:check --all to real workspace source via .prettierignore (agent, planning, and migration-backup docs ignored) and trimmed the root README.md to a neutral greenfield-rebuild shell with no deleted-PoC references or dead links.
- Ran the SC1-SC4 acceptance-command battery across the fully-merged Wave-1 teardown tree and proved it graph-clean and green on Nx's local cache only: zero dangling references, ci.yml free of cache coupling with valid 5-job structure, all five targets a green no-op, and the D-03 dormant cross-OS invariants intact - the committed clean-state proof that gates plan 05's de-priming. No source/config files were modified (verification-only).
- `@op-nx/github-cache` Nx library scaffolded via `nx g @nx/js:lib --bundler=tsc` with fully inferred build/typecheck/test targets, LOCKED published name, zero runtime dependencies, and a green Vitest Wave-0 harness wired into the root TS solution.
- A node:http server speaks the Nx `GET`/`PUT /v1/cache/{hash}` contract end-to-end against a trivial writable Map backend: hard `200` on PUT, `200`+`Content-Length` on GET hit, `404` on miss, `401` on unauth via a per-process CSPRNG bearer compared with `crypto.timingSafeEqual` on fixed 32-byte SHA-256 digests, bound to `127.0.0.1` only — built test-first (RED -> GREEN).
- The Plan 02 round-trip server is hardened into the full Nx status contract: bounded-hex `{hash}` validation (400 before any backend call), a 2 GiB body cap (413 via Content-Length precheck + streaming socket-destroy, never buffered unbounded), best-effort reads (get fault -> 404 MISS) with fail-closed writes (put fault -> 500, never a silent 200), and the 409/403 half of the contract fed by a `createReadOnlyMemoryBackend()` seam and a never-guarded `PutResult` map -- all built test-first (RED -> GREEN).
- A real `serve()` composition root binds `127.0.0.1`, mints a CSPRNG bearer token, and answers a scripted authenticated PUT/GET round-trip locally (SC4) with the Windows-safe entry guard + `ERR_SOCKET_BAD_PORT`-proof port resolver baked in; and the TEST-07 two-layer conformance fixture locks the Nx contract — a sha256 drift guard over the full committed vendored OpenAPI spec (never `info.version`) plus a behavioral run asserting the hard `200` on PUT success + `401`/`403`/`404`/`409` + `Content-Length` — with the sha256 mechanism proven RED (wrong placeholder digest FAILS) before GREEN.
- Took the project's first runtime dependencies -- `@actions/cache@6.2.0` and `@actions/core@3.0.1` -- under an exact, human-approved pin and locked the pin with a build-breaking spec (ROBUST-03).
- Built the CREEP write-trust boundary test-first: `isWriteTrusted(env)` trusts only `push` and `schedule` inside GitHub Actions and default-denies every other trigger, with the `TRUSTED_EVENTS` allowlist pinned by deep-equality so an early widening breaks the build (TRUST-03, CVE-2025-36852).
- `withHashLock` -- a module-global `Map<hash,Promise>` that serializes same-hash operations, runs distinct hashes concurrently, evicts each entry on settle, and never wedges on a rejected op (TEST-02), all proven deterministically with deferred promises and a shared order log (no timers).
- The project's first real storage backend: `createActionsCacheBackend()` satisfies the Phase 1 `CacheBackend` port against GitHub's Actions cache through the exact-pinned `@actions/cache` toolkit (`get`->`restoreCache`, `put`->`saveCache`), with every path string flowing through one comment-locked `cacheArchivePath(hash)` helper whose exact produced file name is pinned by a literal-string spec (the silent-MISS guard, ROBUST-03 / ROADMAP SC5).
- selectBackend(env) picks exactly one backend per process from runtime context (writable Actions-cache in trusted CI, read-only everywhere else, no caller-facing mode flag), and serve() composes it with the per-hash write lock plus a bounded SIGTERM in-flight drain.
- Internal node24 JS action runs serve() in its own foreground process and, via a two-job seed->verify pair keyed on github.run_id, proves a real cross-job GitHub Actions-cache HIT on a default-branch push - the phase's headline capability proof and the @actions/cache upgrade canary in one job pair.
- OS-namespaced Release asset-name helper plus a read-only `CacheBackend` that returns this platform's bytes, MISSES any wrong-OS artifact, forbids every write, and degrades every fault to a MISS with one credential-free stderr warning.
- Three-tier local read token chain (env -> gh auth token -> git credential fill) and origin-remote repo identity, both resolved through one hardened, injection-safe, prompt-proof spawn wrapper and both degrading to undefined -- never to an anonymous request or a guessed repo.
- The real authenticated GitHub Releases read client (native fetch, zero new dependency) plus the three-line selectBackend wiring that makes a developer on any OS actually read this repo's CI-produced cache back locally -- resolving token then repo before any request, degrading every fault to a MISS, and never leaking the token across the asset redirect.
- `isSyncTrusted(env, readDefaultBranch?)` — a pure, injectable default-deny publish predicate ({push,schedule} inside Actions on the repository default branch) that is a SEPARATE trust boundary from the write gate, with a 21-test TRUST-02 event/ref matrix and a widening-proof content-pin.
- One coupled retention knob (`resolveMaxAgeDays`, default 30) and a single-source calendar-month `shardTagsForWindow` drive a newest-first reader window walk so a Releases read survives a month boundary, replacing Phase 3's single-shard `shardTag()` stub.
- publishMirror: an injected-client, Octokit-free engine that mirrors only nx-cache- keys per-OS first-write-wins to the current-month Release shard, fails loud pre-upload at the ~2 GiB boundary, skips-and-warns at the 1000-asset cap, and discriminates every fault on error.status.
- Daily single-writer cleanup workflow driving the tested cleanupMirror engine through a real octokit.paginate-backed CleanupClient, with @octokit/rest exact-pinned and range-guarded.
- 1. [Rule 1 - Bug] Prettier drift in the Task 1 publish additions
- Promoted the nx-cache- prefix + HASH_PATTERN into one src/lib/cache-key.ts leaf with a hardened isServerProducedKey (prefix + valid-hex) filter, and routed the Actions-cache backend, the publish/mirror path, and the HTTP server through it so the mirror admits only genuine server-produced keys (TRUST-08 / ADR C16, shipped FIRST per D-09).
- The widened trust.ts allowlist is now the single authored source for a committed, dependency-free CommonJS copy generated by selfcheck.cjs; a two-layer guard (CI byte-diff selfcheck + a full-matrix Vitest semantic-parity spec) fails the build on any drift.
- Adopter-facing ADVISORY PPE-hygiene composite action (ppe/action.yml) self-installing exact-pinned zizmor 1.27.0 + actionlint 1.7.12, mutation-proven by a config-assertion spec, and dogfooded advisory against an unsafe fixture in CI (TRUST-06)
- @op-nx/github-cache flipped to a publish-ready public npm package (files:["dist"] + bin + MIT LICENSE), plus a new uses:-consumable start-cache-server JS action whose committed esbuild bundle is kept honest by a CI drift guard and a dependency-free npm-pack file-list guard.
- Explicit-assertion-list guard enumerating the D-04 consumer contract (barrel value export createCacheServer + 4 type exports, the single `port` action input, 7 env knobs, and the fixed 2 GiB `MAX_CACHE_BODY_BYTES`) that fails `nx test github-cache` on any unintended change; proven with a real RED->GREEN cycle.
- Shipped the two governance files a poisoning-class tool requires -- a root MIT LICENSE (GOV-02) and an advisories-first SECURITY.md (GOV-01) -- plus an allowlist-inversion email-hygiene guard that makes the public-gmail-only rule a CI-enforced invariant, with nx cache inputs wired so the guard actually re-runs when any scanned file changes.
- Rewrote the root README as a 5-minute default CI-RW quickstart and shipped the docs/ set (configuration reference, advanced guide, minimal adopter example) plus a docs-adoption content guard wired to fail on drift.
- docs/trust-and-security.md renders the settled Phase-5 CREEP trust model (write gate + separate sync gate, github.com-only backstop, retention-as-hygiene) and docs/versioning.md defines the 0.x consumer contract, both locked by a single-source drift guard that imports the real trust.ts/sync-gate.ts allowlists.

---
