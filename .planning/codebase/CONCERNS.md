# Codebase Concerns

**Analysis Date:** 2026-07-22

**Scope note:** This codebase is unusually clean for a v0.0.1 ship. Every phase
verification (`.planning/milestones/v0.0.1-phases/*/`) ran a `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`
scan across its modified files and found zero matches; no shortcut markers exist
anywhere in tracked source. Deliberate simplifications are instead documented
inline as `ponytail:` comments with an explicit ceiling and upgrade path (a
project convention, not an ad-hoc habit) -- most items below are those
comments, not defects found by inspection. There are no genuine bugs identified
during this scan; "Known Bugs" is intentionally empty.

## Tech Debt

**Sub-7-day retention read-path visibility (pre-existing SRV-05 property, WARNING, non-blocking):**
- Issue: A consumer who sets `CACHE_MIRROR_MAX_AGE_DAYS` below the 7-day policy
  floor without `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION` gets a loud, correctly
  failing scheduled cleanup job (`resolveMaxAgeDays` throws -- see
  `packages/github-cache/src/lib/retention.ts:109-125`). But the READ path
  resolves the same knob through the same `resolveMaxAgeDays` call
  (`packages/github-cache/src/backend/releases-backend.ts:325`), and its
  degrade-to-MISS discipline swallows that throw into a silent cache miss,
  logged only once per process to stderr via `warnOnce`
  (`packages/github-cache/src/backend/releases-backend.ts:28-53`) -- never a
  GitHub Actions annotation (`core.warning`/`core.error`).
- Files: `packages/github-cache/src/lib/retention.ts` (lines 104-107 explicitly
  document the tradeoff as accepted), `packages/github-cache/src/backend/releases-backend.ts`
  (lines 28-53, 87-95).
- Impact: An operator who watches only the GitHub Actions UI (not raw runner
  stderr/logs) can see a sudden all-MISS build with no visible cause -- the
  cleanup job for the SAME misconfiguration is red and actionable, but the read
  path's degradation is invisible in the same UI surface. Confirmed still
  present in the current tree; explicitly logged as the sole open item in the
  v0.0.1 milestone audit (`.planning/milestones/v0.0.1-MILESTONE-AUDIT.md`,
  `tech_debt` frontmatter) and accepted as consistent with the SRV-05
  read-must-never-break-build discipline (a loud read-path failure would
  violate that discipline).
- Fix approach: If this visibility gap is ever prioritized, surface the same
  refusal as a `core.warning`/annotation from the consumer-facing `serve()`
  process (not the read backend itself, which must stay silent-on-fault by
  contract) -- e.g. a one-time startup check that calls `resolveMaxAgeDays` and
  annotates before entering the request-serving loop, so the loud signal
  reaches the Actions UI without touching the per-request degrade-to-MISS path.

**No npm-publish automation:**
- Issue: The package (`@op-nx/github-cache`) is fully publish-ready --
  `packages/github-cache/package.json` has `publishConfig.access: "public"`,
  correct `exports`/`bin`/`files` allowlist, and CI enforces a byte-identical
  action bundle (`npm run check:action`) and a tarball file-list guard
  (`pack:check` / `pack-check.cjs`) -- but no CI job runs `npm publish` or
  `npm version`. `git grep` across `.github/workflows/*.yml` finds no
  `NPM_TOKEN`, no `registry-url` on any `actions/setup-node@v6` step, and no
  publish job.
- Files: `.github/workflows/ci.yml` (429 lines, no publish job),
  `packages/github-cache/package.json`.
- Impact: A version bump and `npm publish` must currently be run by hand from a
  maintainer machine; there is no CI-driven release pipeline, no provenance
  attestation, and no protection against a manual publish from a stale/dirty
  checkout.
- Fix approach: Add a tag-triggered (or release-triggered) publish workflow
  gated on the same trust checks already proven in `ci.yml` (build + typecheck
  + test + pack:check + check:action all green first), using OIDC-based npm
  provenance (`npm publish --provenance`) rather than a long-lived `NPM_TOKEN`
  where possible. Out of scope for this concerns document to design further --
  flagging the gap only.

**In-process-only concurrency primitives (documented ceiling, not a defect):**
- Issue: `withHashLock` (`packages/github-cache/src/lib/with-hash-lock.ts`)
  serializes same-hash cache operations via an in-memory `Map`, explicitly
  commented as `// ponytail: global in-process map`. It cannot serialize across
  OS processes.
- Files: `packages/github-cache/src/lib/with-hash-lock.ts:1-4`,
  `packages/github-cache/src/lib/cache-archive-path.ts:19-32` (the shared temp
  path this lock protects).
- Impact: `cacheArchivePath()` returns a deterministic, hash-keyed temp file
  path shared by every process using the Actions-cache backend. Two processes
  operating on the same hash (e.g. `serve()` and `publishMirror()` run
  concurrently in the same job/container) can race: one leg's `rm` deletes the
  archive the other is about to save (a silently dropped write), or one leg's
  `writeFile` overwrites the archive the other is reading (wrong bytes
  mirrored). No supported deployment currently reaches this -- `ci.yml` and
  `docs/advanced.md` both run publish as a separate sequential step -- so this
  is a documented ceiling, not an active bug.
- Fix approach (only if a colocated deployment is ever supported): a
  cross-process advisory lock keyed on the hash (an `fs.mkdir` sentinel plus a
  stale-lock TTL), not a different temp-path scheme (the path string is
  version-hashed by `@actions/cache` and is comment-locked -- see
  `cache-archive-path.ts:11-17`) and not a new dependency.

**PUT body fully buffered in memory (documented ceiling):**
- Issue: `handlePut` in `packages/github-cache/src/server/server.ts:203-234`
  buffers the entire request body into an array of `Buffer` chunks (up to the
  2 GiB cap) before calling `backend.put`. `withHashLock` only serializes
  same-hash PUTs; distinct-hash PUTs run concurrently, so N concurrent
  distinct-hash PUTs can hold up to N x 2 GiB resident at once.
- Files: `packages/github-cache/src/server/server.ts:203-208` (ponytail
  comment documents the ceiling explicitly).
- Impact: Acceptable for the documented single-tenant loopback sidecar
  deployment (one Nx client talking to one `serve()` instance), but would be a
  real memory-exhaustion risk under any multi-client deployment.
- Fix approach (only if multi-client support is ever added): stream to a temp
  file instead of `Buffer.concat`, rather than raising or removing the
  per-request byte cap.

**413-response RST on oversized streaming PUT (documented HTTP/1.1 limitation, not fixable):**
- Issue: When a PUT body exceeds `maxBodyBytes` (mid-stream, not caught by the
  `Content-Length` fast path), the server responds 413 and calls
  `req.destroy()`. For a large in-flight body (verified: 60/60 RST on a 100 MB
  raw-socket repro; any body >=256 KB over the cap), destroying the socket with
  unread inbound data triggers a TCP RST, which the client observes as
  `ECONNRESET` rather than a clean 413 response.
- Files: `packages/github-cache/src/server/server.ts:188-201`,
  `:218-229` (both destroy sites carry the same documented rationale, added in
  commit `cb2832d`).
- Impact: A client sending a grossly oversized body sees a connection reset
  instead of a diagnosable 413. The cap's actual purpose -- bounding server
  memory before `Buffer.concat` -- still holds regardless of what the client
  observes.
- Fix approach: None available over single-connection HTTP/1.1 -- explicitly
  documented as not fixable by deferring `destroy()` to `res.on('finish')`
  (still resets, can also hang on an unsettled await) or by draining the body
  first (defeats early rejection, reintroduces the memory-exhaustion risk this
  guard exists to prevent). No action needed; this is closed technical debt,
  recorded for future readers who might otherwise "fix" it into a worse state.

**Ambiguous saveCache `-1` sentinel (structural ambiguity, mitigated not eliminated):**
- Issue: `@actions/cache`'s `saveCache` (pinned v6.2.0) collapses every
  non-`ValidationError` fault -- 5xx, network errors, `CacheWriteDeniedError`,
  `FinalizeCacheError`, over-data-cap -- into the same `-1` return sentinel used
  for a benign "entry already exists" no-op. The backend disambiguates with a
  follow-up `lookupOnly` existence probe, but a genuine cache-service outage
  and a benign scope-denied write are still structurally indistinguishable at
  this layer; both produce a 409 today.
- Files: `packages/github-cache/src/backend/actions-cache-backend.ts:71-124`.
- Impact: A real infrastructure outage on the write path is reported to the
  operator as the same 409/warning as an expected, benign PR-scope denial --
  an operator cannot tell "everything is fine, this was a read-only PR
  context" from "the cache service silently ate this write" without reading
  the warning text and cross-referencing the trigger event by hand.
- Fix approach: Accepted as-is by design (documented in the file); a stronger
  fix would require `@actions/cache` itself to distinguish these cases
  upstream. Not actionable within this repo.

## Known Bugs

None identified. The v0.0.1 milestone audit (`.planning/milestones/v0.0.1-MILESTONE-AUDIT.md`)
found zero unsatisfied requirements, zero broken integration flows (6/6
end-to-end flows WIRED, independently re-verified against live CI runs), and
zero open security threats at `block_on: high`. Every phase-verification pass
scanned for stub/placeholder markers and found none.

## Security Considerations

**In-code write-trust host gate is fork-spoofable defense-in-depth, not the load-bearing control:**
- Risk: `hostSupportsWidenedTrust` (`packages/github-cache/src/lib/trust.ts:44-55`)
  infers GitHub's server-side read-only-default-branch cache guard from the
  `GITHUB_SERVER_URL` environment variable. A fork PR or other untrusted
  trigger could, in principle, attempt to inject a spoofed value for this
  variable.
- Files: `packages/github-cache/src/lib/trust.ts:12-16, 36-55`.
- Current mitigation: The in-code gate is explicitly documented (and accepted
  in `05-SECURITY.md`, threat `T-05-01-01`, severity high, disposition
  "accept (residual)") as defense-in-depth ONLY. The actual load-bearing
  control is GitHub's own server-side read-only cache token enforcement on
  non-default-branch triggers (the 2026-06-26 GitHub change), combined with
  the `{push, schedule}` sync gate (`sync-gate.ts`) and the adopter
  prerequisite of default-branch protection. `GITHUB_SERVER_URL` itself is
  runner-injected and not attacker-controllable in the ordinary case; the
  acceptance is about defense-in-depth layering, not a live exploit.
- Recommendations: None beyond what is already documented -- this is a
  deliberate, reviewed acceptance, not a gap. Any future change that makes the
  in-code gate load-bearing (rather than advisory) would need to re-derive
  trust from a source GitHub itself signs, not a plain env var.

**Cleanup path's defense-in-depth trust gate (`isTrustedSyncEvent`) is narrower than the general sync gate:**
- Risk: `isTrustedSyncEvent` (`packages/github-cache/src/lib/sync-gate.ts:117-121`)
  checks only `GITHUB_ACTIONS === 'true' && GITHUB_EVENT_NAME === 'schedule'`
  -- it deliberately does NOT verify the default branch, unlike `isSyncTrusted`.
  This was previously an open question (quick task `260721-wtl`) about whether
  the synthesized `schedule` event payload reliably carries
  `repository.default_branch`.
- Files: `packages/github-cache/src/lib/sync-gate.ts:94-121`.
- Current mitigation: Resolved -- quick task `260721-wtl` empirically confirmed
  the `default_branch` field IS present in the synthesized schedule payload
  today, but the narrower gate is deliberately kept anyway for robustness (a
  schedule-only gate needs no ref check by construction, since GitHub only
  fires `schedule` on the default branch). Documented as intentional, not a
  gap.
- Recommendations: None -- already resolved and documented.

**No content-signing / provenance verification yet (deferred, not a v0.0.1 gap):**
- Risk: Cache entries carry no cryptographic provenance attestation. A
  compromised writer with valid trust (e.g. a maintainer's leaked token) could
  still poison a cache entry undetected by any signature check.
- Files: N/A (feature does not exist yet); tracked as **PROV-01** in
  `.planning/PROJECT.md` and `.planning/milestones/v0.0.1-REQUIREMENTS.md`.
- Current mitigation: `ARCHITECTURE-DECISION.md` explicitly rejects content
  signing as a CREEP control for v0.0.1: CVE-2025-36852's poisoning precedes
  hashing, so signing the bytes verifies transport integrity, not
  correctness-for-the-key. CREEP is instead defended at the write/sync trust
  gates (this repo's actual control surface).
- Recommendations: PROV-01 (reader-verified cosign keyless attestation via
  OIDC) is an explicit later-milestone item, deliberately deferred until it
  can pair with GHCR-01 (see Deferred Later-Milestone Triggers below) where
  native OCI provenance tooling applies more cleanly than to Releases assets.

## Performance Bottlenecks

**Publish throttling paces uploads at ~1/second:**
- Problem: `createResilientOctokit` (`packages/github-cache/src/lib/resilient-octokit.ts:32-36`)
  accepts the Octokit throttling plugin's defaults, including the write
  group's `minTime: 1000`ms.
- Files: `packages/github-cache/src/lib/resilient-octokit.ts`.
- Cause: A deliberate acceptance of upstream's rate-limit-safe defaults rather
  than a custom throttle profile.
- Improvement path (documented in-file, only if it ever hurts): a per-group
  throttle override on the resilient-Octokit factory -- not removing the
  plugin, which is what prevents secondary-rate-limit bans. A full 1000-asset
  shard could add up to ~16 minutes of wall clock to a single publish leg;
  acceptable today because publish runs as a push-only background mirror, not
  on the CI-blocking critical path.

**Reader walks month-shards sequentially, oldest read cost grows with retention window:**
- Problem: `shardTagsForWindow` (`packages/github-cache/src/lib/retention.ts:134-153`)
  and the reader's shard walk (`releases-backend.ts:319-333`) query GitHub's
  REST API once per month-shard, newest-first, stopping at the first hit. A
  cold read for an asset only present in the oldest shard of a long retention
  window (up to 365 days = up to 13 shard queries) pays that full sequential
  cost before returning a MISS.
- Files: `packages/github-cache/src/backend/releases-backend.ts:319-333`,
  `packages/github-cache/src/lib/retention.ts:127-153`.
- Cause: A single coupled retention knob deliberately serves both read-window
  and prune-window duty (comment-locked, `retention.ts:1-18`) -- introducing a
  parallel or indexed lookup would require either a second knob or an
  additional index structure, both explicitly rejected to avoid the read/prune
  window ever drifting apart (the documented Pitfall 7/8 failure mode: a
  silent cross-OS MISS with no error).
  Each shard query itself has a bounded 5-second control-plane timeout
  (`FETCH_TIMEOUT_MS`), so worst case is bounded, not unbounded.
- Improvement path: Not identified as a current pain point (default window is
  30 days = at most ~2 shard queries in the common case); only relevant if a
  consumer sets `CACHE_MIRROR_MAX_AGE_DAYS` near the 365-day ceiling and reads
  are latency-sensitive. No fix proposed; flagging for awareness only.

## Fragile Areas

**Cross-OS byte-parity invariants: comment-locked, fail silently if broken.**

Three separate load-bearing invariants share the same failure signature (a
silent cache MISS, never an error or crash) if anyone edits them casually:

1. `.gitattributes` (`* text=auto eol=lf`) -- forces LF line endings on
   checkout across every platform. Nx hashes file CONTENTS; a Windows checkout
   with CRLF would compute different task hashes than Linux/macOS, breaking
   cross-OS cache hits silently.
   - Files: `.gitattributes`.
   - Why fragile: A single misconfigured `.gitattributes` rule (or a
     contributor bypassing it with `core.autocrlf` overrides) reintroduces
     drift with no test that would catch it locally on Windows.
   - Safe modification: Never edit without re-verifying an end-to-end cross-OS
     cache hit in CI (the `integration` matrix leg across OSes).

2. `packages/github-cache/src/lib/cache-archive-path.ts` (`cacheArchivePath`)
   -- the ONE function producing the temp-path string passed to
   `@actions/cache`. `@actions/cache` version-hashes the LITERAL path string
   together with the compression choice, so any cosmetic edit (inlining,
   reformatting, renaming the file stem) silently changes the derived cache
   version and every restore MISSes with no error.
   - Files: `packages/github-cache/src/lib/cache-archive-path.ts:11-17`
     (comment-locked, "Pitfall 7").
   - Why fragile: The failure mode produces zero diagnostic signal -- CI stays
     green, cache hit rate silently drops to zero.
   - Safe modification: Never touch without re-verifying an end-to-end restore
     in CI (the dogfood canary); pinned by `cache-archive-path.spec.ts`.

3. `packages/github-cache/src/lib/retention.ts` (`shardTag` /
   `SHARD_TAG_PREFIX` / `shardTagsForWindow`) -- the ONE home for the
   `cache-mirror-YYYYMM` month-shard tag scheme, shared by both the Phase 3
   reader and the Phase 4 publisher. A drift between two tag derivations is a
   silent cross-OS MISS with no error, no crash -- just a wave of unexplained
   rebuilds.
   - Files: `packages/github-cache/src/lib/retention.ts:1-18` (comment-locked,
     "Pitfall 7"), consumed by `releases-backend.ts:325` and
     `publish-mirror.ts:12,158`.
   - Why fragile: Same silent-MISS failure signature as above; no runtime
     assertion cross-checks reader and publisher tag derivation against each
     other outside of shared-function reuse.
   - Safe modification: Never inline the template, never change the separator
     or UTC/zero-pad rules without re-verifying an end-to-end cross-OS read.
     Exact produced tags are pinned by `retention.spec.ts`.

**Per-OS publish-mirror matrix and single-source `releaseAssetName`:**
- Files: `packages/github-cache/src/lib/release-asset-name.ts`,
  `.github/workflows/ci.yml` (the `publish` job's per-OS matrix, around line
  326-395).
- Why fragile: The OS-namespaced asset-name derivation
  (`release-asset-name.ts`) is the single source both the read backend and the
  publish engine import as a namespace import (never re-derived locally,
  per `releases-backend.ts:20-22` and `publish-mirror.ts:11`). If a future
  editor inlines or duplicates this derivation at a new call site instead of
  importing the shared helper, the drift is -- again -- a silent cross-OS
  MISS, not a crash.
- Safe modification: Always import `releaseAssetName` from
  `lib/release-asset-name.ts`; never compose an asset name inline at a new
  call site.

**`with-hash-lock.ts` is a genuine single point of correctness for concurrent same-hash operations:**
- Files: `packages/github-cache/src/lib/with-hash-lock.ts`.
- Why fragile: A subtle change to the promise-chaining logic (e.g. losing the
  "settle on both resolve and reject" `.then(fn, fn)` pattern, or the
  identity-checked eviction) could silently reintroduce either a wedged queue
  (one rejected op blocking all future same-hash callers) or a leaked map
  entry (memory growth over a long-running process).
- Test coverage: `with-hash-lock.spec.ts` exists and exercises this; treat any
  change here as requiring full re-verification against that spec, not just a
  visual diff review.

**Route-guard ordering in `server.ts`'s request handler is load-bearing:**
- Files: `packages/github-cache/src/server/server.ts:58-137` (the fixed
  guard-clause ladder: route -> method -> auth -> hash-validate -> body-cap ->
  backend -> status-map).
- Why fragile: The comment explicitly calls the ORDER load-bearing (e.g. hash
  validation must occur before any backend call is reached, SRV-03; PUT to a
  read-only backend must map to 403 only after auth and hash validation, not
  before). Reordering these guards changes observable status codes for
  malformed/unauthorized/oversized requests in ways not obviously wrong at a
  glance, but that would violate the documented contract.
- Safe modification: Preserve guard order exactly; `server.spec.ts` and
  `public-server.integration.spec.ts` pin the current behavior.

## Scaling Limits

**1000-asset-per-release cap (month-shard):**
- Current capacity: Each month-shard release holds up to 1000 assets
  (`RELEASE_ASSET_CAP`, `packages/github-cache/src/publish/publish-mirror.ts:28`).
- Limit: A shard at the cap degrades new entries to skip-and-warn (a cache
  MISS-on-write), never a hard failure -- but a workspace producing more than
  1000 unique (hash, OS) pairs per month would see a growing fraction of
  writes silently skipped.
- Scaling path: Not automated. If ever needed, would require sub-monthly
  sharding (e.g. weekly) or an additional dimension in the tag scheme -- both
  would need the same single-source-of-truth discipline `retention.ts`
  currently enforces for the monthly scheme.

**~2 GiB per-asset ceiling (GitHub Releases hard limit, coincides with the server's body cap):**
- Current capacity: `RELEASE_ASSET_MAX_BYTES` and `MAX_CACHE_BODY_BYTES` are
  both `2 * 1024 * 1024 * 1024` bytes, deliberately kept equal
  (`publish-mirror.ts:20`, `server.ts:17`) so an entry the server accepts can
  never subsequently fail the mirror.
- Limit: An artifact at or over this size fails the run loud (never truncated
  or silently dropped) rather than partially uploading.
- Scaling path: None within the current architecture -- this is a genuine
  GitHub Releases platform ceiling, not a tunable. A future GHCR-01 backend
  (see below) would have a different ceiling profile; re-evaluated only if
  that migration happens.

## Dependencies at Risk

None identified as urgent. Runtime dependencies are minimal and version-pinned
(`@actions/cache@6.2.0`, `@actions/core@3.0.1`, `@octokit/plugin-retry@8.1.0`,
`@octokit/plugin-throttling@11.0.3`, `@octokit/rest@22.0.1` --
`packages/github-cache/package.json`). The project deliberately favors
zero/low-dependency design (native `fetch`, native `AbortSignal.timeout`,
`node:crypto`, `node:http`) documented throughout as a stated goal (D-01/D-03
"zero-dependency-lean" references appear across `releases-backend.ts`,
`resilient-octokit.ts`, etc.). No deprecated or end-of-life packages observed.

## Missing Critical Features

Nothing rises to "missing critical feature" for v0.0.1's stated scope -- the
milestone audit confirms all 39 in-scope requirements satisfied. The items
below are deliberately out of scope, not gaps:

- npm-publish CI automation (see Tech Debt above -- arguably closer to a real
  gap than the deferred items, since the package is otherwise complete).

## Test Coverage Gaps

No specific gap was identified during this scan -- Nyquist compliance is
recorded as 7/7 across all phases, and 430 unit tests + 3 integration tests
run green as of the milestone audit HEAD. If a gap exists, it was not
surfaced by this pass; treat validation status as current per
`.planning/milestones/v0.0.1-MILESTONE-AUDIT.md` rather than re-deriving it
here.

## Deferred Later-Milestone Triggers

These are LOCKED architectural decisions (not accidental gaps), recorded in
`.planning/ARCHITECTURE-DECISION.md` and `.planning/milestones/v0.0.1-REQUIREMENTS.md`,
re-evaluated together when their shared trigger condition is met.

**GHCR-01 -- GHCR/OCI as an additional synced store:**
- Status: Deliberately deferred, not built. v0.0.1 locked GitHub Releases as
  the sole reader/cross-context store on forward merits (fewer
  incident-response hazards; no public poison-remediation gap -- GHCR's
  >5000-download undeletable wall has no self-service remediation, unlike
  Releases).
- Trigger to revisit: Re-run the FOUND-01 decision ledger when PROV-01 (cosign
  attestation) and the Docker container form (FOUND-03) graduate together --
  at that point GHCR's cost drops (already operating the registry) and its
  benefit rises (native cosign provenance for image + cache).
- What comes back if adopted: pull-by-digest (C6), the >5000-download
  non-fatal handling (RETAIN-02/C10), the delete-credential/PAT + child-manifest
  cleanup surface (RETAIN-03-GHCR/C11/C13), the publish-time
  package-visibility fail-closed assert (TRUST-09/C18), and the best-effort
  no-overwrite variant (TRUST-07-GHCR).
- Reversibility: Additive, not a switch -- only the reader read path is
  behind the `CacheBackend` port; v0.0.1's Releases store keeps serving
  regardless of a future GHCR addition.

**PROV-01 -- optional reader-verified cosign keyless provenance attestation:**
- Status: Deliberately deferred (one line by design per
  `ARCHITECTURE-DECISION.md` control C7). Explicitly never content signing,
  never HMAC -- would only be clean on a GHCR/OCI backend.
- Trigger to revisit: Paired with GHCR-01 and FOUND-03 (Docker) graduating
  together.

**FOUND-03 (Docker) -- Docker container distribution form:**
- Status: Deliberately deferred. v0.0.1 ships npm package + JS Action only.
  The CI `services:`-sidecar motivation that would normally justify a Docker
  form is already covered by the GA "background step" pattern (`background:`
  step attribute + `cancel`), proven live in CI (DOCS-06,
  `docs/advanced.md`), which works cross-OS unlike a Linux-only
  `services:` container.
- Trigger to revisit: A later milestone, or on-demand if a genuinely hermetic
  / non-Node CI use case appears (Docker's stated residual niche).
- Requirements already delivered in anticipation: `serve()` handles `SIGTERM`
  gracefully (the `cancel` step sends `SIGTERM` then `SIGKILL` after a short
  grace) and docs show the background-step pattern with an explicit `cancel`
  teardown.

---

*Concerns audit: 2026-07-22*
