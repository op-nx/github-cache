# Phase 4: Publish + Retention + Observability - Context

**Gathered:** 2026-07-19 (smart discuss: `--analyze --auto`)
**Status:** Ready for planning

<domain>
## Phase Boundary

The default-branch `{push,schedule}`-gated publish/sync engine mirrors CI-produced Actions-cache
entries to GitHub Releases, prunes them by age safely, fails loud on whole-run failure, and
degrades gracefully at the storage caps instead of breaking the build. Mode: MVP.

Delivers requirements TEST-03, TEST-04, TEST-06, ROBUST-01, ROBUST-02, ROBUST-05, TRUST-02,
TRUST-07, RETAIN-01, RETAIN-03, OBS-01.

IN SCOPE: the sync-gate predicate (separate from the write gate); the out-of-band publish/mirror
engine behind an injected Octokit client; the per-OS publish matrix; age-based cleanup as a
separate scheduled workflow; the month-shard read-window walk (`shardTagsForWindow`) coupled to
the single retention knob; the 1000-asset and ~2 GiB cap behaviours; workflow-annotation
observability; the live cross-OS round-trip that Phase 3 deferred here.

OUT OF SCOPE (Phase 5+): write-trust widening to `pull_request`/`release` (TRUST-01); the
dependency-free action-context allowlist copy + parity assertion (TRUST-04); the shipped PPE
hygiene gate (TRUST-06); the full server-produced-key filter with its single source of truth
(TRUST-08 -- Phase 4 ships only the cheap prefix filter, see D-16); consumer docs (DOCS-01..06,
Phase 6). Also out: synchronous write fan-out, an LRU manifest, a second retention knob.

</domain>

<decisions>
## Implementation Decisions

### Publish / Sync Engine (TRUST-02, TRUST-07, TEST-03, ROBUST-01)

- **D-01 (sync gate is a SEPARATE predicate):** the publish/sync gate is its own predicate --
  `{push, schedule}` AND the default branch -- and is NOT `isWriteTrusted` (`lib/trust.ts`). The
  two sets coincide today (`TRUSTED_EVENTS = ['push','schedule']`), which makes reuse tempting and
  wrong: Phase 5 / TRUST-01 widens the WRITE allowlist to `pull_request`/`release`, and a shared
  predicate would silently widen SYNC at the same time -- recreating the CREEP precondition ADR C2
  exists to prevent. Test-lock rejection of `pull_request`, `release`, `repository_dispatch`,
  `workflow_dispatch`, `merge_group`, `delete`, `registry_package`, `page_build`, and non-default
  refs. The default-branch check is part of the predicate, not a workflow-level `if:` alone.
  (ADR C2, "load-bearing"; PROJECT.md Key Decisions.)

- **D-02 (out-of-band publish, NOT dual-write):** the publisher is a separate job that runs after
  CI, reads entries out of the Actions cache, and uploads them to Releases. It is NOT an inline
  fan-out from `put()`. ADR Decision 1 defers "synchronous write fan-out" explicitly, and
  REQUIREMENTS lists it under Deferred. The serve path stays untouched by this phase.

- **D-03 (per-OS publish matrix -- LOAD-BEARING):** the publish job is a matrix over
  `[ubuntu-24.04-arm, windows-11-arm]` and each leg mirrors ONLY the entries it can restore on its
  own OS. An ubuntu job can NEVER restore a Windows-saved Actions-cache entry: `@actions/cache`'s
  `getCacheVersion` folds the RAW `paths` strings (`os.tmpdir()` differs per OS) plus a
  `windows-only` salt plus the compression method into the version hash. This was proven
  empirically on the spike -- a green run mirrored all 28 ubuntu-written hashes and ZERO
  Windows-written ones. `enableCrossOsArchive` does NOT fix it (the windows-11-arm image omits
  zstd and falls back to gzip, so the version still mismatches). The failure mode is a SILENT
  skip, not an error. Publish legs are UPLOAD-ONLY; cleanup is separate (D-09).

- **D-04 (Octokit for publish + cleanup):** publish and cleanup I/O go through first-party Octokit
  and discriminate faults STRUCTURALLY on `error.status`, never on stderr text. This accepts a
  deliberate asymmetry with the Phase 3 reader, which uses native `fetch` and `res.status`: the
  reader is on the zero-dep serve path, the publisher is a bin/action where a dependency is
  already normal (`@actions/cache`, `@actions/core` are exact-pinned). ROBUST-01, ROADMAP SC2 and
  ADR C12 all name Octokit explicitly. Do NOT retrofit the reader to Octokit in this phase.

- **D-05 (first-write-wins / no overwrite, TRUST-07):** the mirror never overwrites an existing
  hash-named asset. A same-hash trusted write is byte-identical under CORR-01, so an
  already-exists response is a benign no-op, discriminated structurally (`error.status`) and never
  treated as a fault. An already-exists must never be conflated with a real fault, and a real
  fault must never be treated as absence.

### Retention & Cleanup (RETAIN-01, RETAIN-03, TEST-04, TEST-06)

- **D-06 (age-only, `created_at`):** retention prunes on absolute asset age via `created_at`. NO
  LRU and NO manifest. Release assets expose no last-accessed field: `download_count` is
  cumulative and never decays, and downloads do not bump `updated_at`. A stateful manifest is
  mutable shared retention state (security-negative). (ADR C8 + Decision 5; the standing project
  retention rule.)

- **D-07 (ONE coupled knob; default = 30 days):** `CACHE_MIRROR_MAX_AGE_DAYS` drives BOTH the
  cleanup window and the reader's month-shard lookback through shared resolution. Never introduce
  a second knob -- read-window vs retention-window drift makes an asset simultaneously unreadable
  (reads do not scan its shard) and unprunable (cleanup does not visit it), leaking toward the
  1000-asset cap. **Default = 30 days**, decided against researched prior art (see `<specifics>`):
  it matches the monthly shard quantum 1:1, so the read window is 1-2 shards; it is 4x the 7-day
  access-clock caches, which is the correct compensation for our harsher creation clock; and it
  stays the same order of magnitude as CircleCI's 15-day cache cap (the closest analog on both
  clock and purpose). Explicitly NOT 90 days: hit probability decays with age, so shards 3-4 would
  cost every MISS a lookup while almost never hitting.

- **D-08 (month-shard read-window walk):** implement `shardTagsForWindow(maxAgeDays)` and replace
  the Phase 3 single-shard stub (`shardTag()` in `releases-backend.ts:139`, explicitly marked
  `ponytail:` with this upgrade path). The walk returns the shard tags covering the retention
  window, newest first, and a lookup stops at the first hit. A MISS must exhaust the window before
  concluding MISS. At 30 days this is 1-2 shards. Per-process memoization of resolved shard
  release IDs (the existing ME-01 pattern in `createReleasesReadClient`) is an OPTIONAL
  optimization at this width, not a prerequisite.

- **D-09 (cleanup = a SEPARATE scheduled workflow):** cleanup lives in its own scheduled workflow
  (daily), NOT as a job inside ci.yml and NOT inside a publish matrix leg. A single scheduled job
  is a single cleanup writer BY CONSTRUCTION -- no env gate, no OS-name expression, no concurrent
  delete-asset race -- and it honours the TTL on a calendar cadence even while the repo is idle,
  which a push-triggered prune cannot. Runs under a `concurrency:` group that QUEUES rather than
  cancels, using the same `contents:write` `GITHUB_TOKEN` that publishes (RETAIN-03; no PAT, no
  special scope).

- **D-10 (list-phase aborts, delete-phase isolates):** the cleanup list phase aborts with ZERO
  deletions on any non-404 fault or incomplete pagination -- a swallowed list fault reads as
  authoritative absence and would delete live data. The delete phase isolates per-item failures
  and exits non-zero on aggregated failure. Deletion is PER-ASSET, not whole-shard-release drop.
  The test injects a mid-pagination fault and asserts no deletion occurred. (ADR C9, RETAIN-01,
  TEST-04.)

### Caps & Failure Modes (ROBUST-02, ROBUST-05)

- **D-11 (1000-asset cap -> skip-and-warn):** a shard that has reached the 1000-asset per-release
  cap causes the publish path to SKIP the entry and emit a workflow annotation, never to hard-fail
  the build. The cap degrades to a MISS-on-write. Note the cap is PER RELEASE (per month shard),
  so it tracks monthly write volume and is independent of the retention window. (ROBUST-05.)

- **D-12 (~2 GiB boundary -> fail loud, pre-upload):** detect the boundary with a pre-upload
  byte-length check rather than by catching an upload failure, so the outcome is deterministic. An
  artifact at the cap MUST fail loud -- never silently truncate or drop. The Releases ~2 GiB
  per-asset ceiling coincides with the server's 2 GB body cap, so this is a real boundary, not a
  theoretical one. (ROBUST-02.)

- **D-13 (whole-run vs per-item):** a per-item publish failure is isolated and annotated; a
  whole-run publish/sync failure fails loud with a non-zero exit. These are distinct paths and
  both are tested.

### Observability & Key Filter (OBS-01)

- **D-14 (annotations via `@actions/core`):** workflow annotations use `@actions/core`
  (`core.error` / `core.warning` / `core.notice`), already an exact-pinned dependency from 02-01.
  No raw `::error::` string echoing.

- **D-15 (fail loud):** a whole-run publish/sync failure emits a workflow annotation AND exits
  non-zero. Silent degradation is the specific failure this requirement exists to prevent.
  (OBS-01, ADR C17.)

- **D-16 (mirror only server-produced keys -- cheap prefix filter now):** the publisher mirrors
  only keys carrying the existing `nx-cache-` prefix from `cacheKeyFor` (`actions-cache-backend.ts:13`),
  never "any 1-512 hex" Actions-cache key. This is the cheap majority of TRUST-08's value for
  roughly one predicate; the full single-source-of-truth filter with its parity assertion remains
  Phase 5. Safe to sequence this way here because `op-nx/github-cache` is a PUBLIC repo, so ADR
  C16's "must ship before/with enabling the mirror for any PRIVATE repo" constraint is not yet
  binding -- but it MUST be closed in Phase 5 before any private-repo adopter enables the mirror.

- **D-17 ("is the cache working" signal):** emit the OBS-01 signal in this phase (a run summary /
  annotation reporting mirrored, skipped, and pruned counts). The prose documentation of how to
  read it is Phase 6 / DOCS-03, but the signal itself is a Phase 4 requirement and ships here.

### Claude's Discretion

Exact module, file, and function names; the precise injected Octokit client interface shape; the
publish job's placement relative to existing ci.yml jobs; annotation wording; the summary format
for D-17; and whether `shardTagsForWindow` lives beside `shardTag` or in its own module -- all at
the planner's/executor's discretion within the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` (Phase 4 section: goal, 5 success criteria, 3 named risks)
- `.planning/ARCHITECTURE-DECISION.md` (Decision 1 publisher/retention seam + deferred write
  fan-out; Decision 2 sync gate separate; Decision 5 retention/LRU; control ledger C2, C8, C9,
  C12, C15, C16, C17)
- `.planning/REQUIREMENTS.md` (TEST-03/04/06, ROBUST-01/02/05, TRUST-02/07, RETAIN-01/03, OBS-01)
- `.planning/PROJECT.md` (Key Decisions: sync gate load-bearing; Octokit from the start; retention
  is one coupled setting)
- `packages/github-cache/src/lib/trust.ts` (`TRUSTED_EVENTS` / `isWriteTrusted` -- the WRITE gate
  that D-01 must NOT reuse)
- `packages/github-cache/src/lib/release-asset-name.ts` (`releaseAssetName` -- the comment-locked
  single-source OS+hash asset name; the publisher MUST derive names through this helper, D-03/D-07
  of Phase 3)
- `packages/github-cache/src/backend/releases-backend.ts` (`shardTag` line 139 -- the `ponytail:`
  single-shard stub D-08 replaces; `createReleasesReadClient` ME-01 memoization pattern; the
  pagination Pitfall 4 note about never reading inline `release.assets`)
- `packages/github-cache/src/backend/actions-cache-backend.ts` (`cacheKeyFor` line 13 -- the
  `nx-cache-` prefix D-16 filters on; `cacheArchivePath` usage)
- `packages/github-cache/src/lib/cache-archive-path.ts` (comment-locked path helper; the publisher
  restores through this same helper, and D-03's cross-OS gap is a direct consequence of it)
- `.github/workflows/ci.yml` (existing job shape, the integration matrix, the dogfood-seed /
  dogfood-verify pair, and the `permissions: contents: read` default the publish job must widen)
- `.planning/research/PITFALLS.md` (Pitfall 4 pagination; Pitfall 7 silent-MISS single-source
  helpers; Pitfall 9 MISS-not-wrong-result)
- `.planning/spikes/005-cross-os-roundtrip/` (the already-proven live cross-OS matrix round-trip)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `releaseAssetName` / `cachePlatform` (`lib/release-asset-name.ts`) -- the single-source
  OS-namespaced asset name. The publisher consumes this UNCHANGED; the key scheme settled in
  Phase 3.
- `cacheKeyFor` (`backend/actions-cache-backend.ts:13`) -- supplies the `nx-cache-` prefix D-16
  filters on.
- `cacheArchivePath` (`lib/cache-archive-path.ts`) -- the publisher's restore path must resolve
  through this same helper.
- `shardTag` (`backend/releases-backend.ts:139`) -- the single-shard stub carrying an explicit
  `ponytail:` upgrade-path comment pointing at this phase.
- ME-01 promise-memoization pattern (`createReleasesReadClient`) -- reusable for shard-release-ID
  caching (D-08).
- Injected-client + `vi.mock` test convention (`actions-cache-backend.spec.ts`,
  `releases-backend.spec.ts`, `select-backend.spec.ts`) -- the TEST-03/TEST-04 harness style.

### Established Patterns
- Single-source comment-locked helpers; the failure mode is a silent MISS, never a crash.
- Structural fault discrimination on status codes, never stderr/text matching.
- Best-effort READ (fault -> MISS) but fail-closed WRITE -- and cleanup must fail LOUD, since a
  swallowed fault there reads as absence and deletes live data (already called out in
  `releases-backend.ts`'s header comment).
- Injected clients in tests, never live network.
- Exact-pinned dependencies guarded by `pinned-deps.spec.ts` -- adding Octokit (D-04) must extend
  that guard.
- TDD mandatory (`workflow.tdd_mode: true`); MVP mode is set for this phase.

### Integration Points
- New sync-gate predicate beside (not inside) `lib/trust.ts`'s write gate.
- New publish/mirror module + bin, behind an injected Octokit client.
- New cleanup module + bin, invoked by a new scheduled workflow.
- `shardTagsForWindow` replacing the `shardTag` stub, consumed by BOTH the reader and cleanup.
- `.github/workflows/ci.yml` gains the per-OS publish matrix; a new scheduled cleanup workflow is
  added. Both need `contents: write` (the workflow default is `contents: read`).

</code_context>

<specifics>
## Specific Ideas

### Retention prior-art research (settles D-07)

Researched 2026-07-19 against primary sources. The decisive axis is WHICH CLOCK a policy measures.

| System | Default | Clock |
|---|---|---|
| GH Actions cache | 7 days + 10 GB repo LRU | last access |
| Azure Pipelines cache | 7 days of no activity; no size limit | last access |
| ccache | size/count LRU, no TTL at all | last access |
| bazel-remote | size LRU (`--max_size` required), no TTL at all | last access |
| CircleCI cache | **15 days -- also the maximum**, configurable 1d-15d | creation |
| GH Actions artifacts | 90 days; 1-90 public / 1-400 private | creation |
| GHCR / Packages | none; manual deletion only | n/a |
| Nx `s3-cache`/`azure-cache`/`gcs-cache` | no retention documented (delegated to bucket lifecycle) | n/a |
| Turborepo Remote Cache | not documented | n/a |
| Nx Cloud (Nx Replay) | not published | n/a |

Verified: GitHub Releases have a 2 GiB per-asset limit and 1000 assets per release, but
"There is no limit on the total size of a release, nor bandwidth usage."

Three conclusions the planner should carry:
1. **Dedicated build caches do not do age TTL at all** -- they do size-bounded LRU. Age TTL is the
   CI-PLATFORM pattern. We cannot follow the build-cache norm because Release assets expose no
   last-accessed field; that is the storage primitive foreclosing the norm, not a preference.
2. **The 7-day figures are not comparable to ours.** They measure an access clock that resets on
   use; ours is a creation clock that does not. Applying 7 to a creation clock would be far more
   aggressive than GitHub's own cache behaviour.
3. **Every vendor number is set by the vendor's storage cost, and ours is free.** That means the
   table is biased downward relative to our constraints -- but it does not make wider better,
   because hit probability decays with age. 30 days is where the shard quantum, the decay curve,
   and the closest analog (CircleCI) agree.

### Risks carried from the ROADMAP
- Octokit large-asset (~2 GiB) upload via `uploads.github.com` is finicky (Content-Length /
  buffering). Verify a real large-asset upload before relying on it; D-12's pre-upload check is
  the deterministic guard.
- The publish gate and the write gate LOOK like one predicate and are two trust boundaries (D-01).
- Cleanup safety hinges on the list phase aborting BEFORE any delete on partial pagination (D-10).

### Research pointers for the planner (gsd-phase-researcher)
1. Octokit release-asset upload semantics for the already-exists case: exact `error.status` for a
   duplicate asset name (422 vs 409), and the large-asset upload path's Content-Length handling.
2. The Actions Cache Management REST API (`GET /repos/{o}/{r}/actions/caches`) shape for
   enumerating default-branch entries to mirror -- pagination, `ref` scoping, and whether the
   listed `key` is enough to drive `restoreCache` on the same OS.

</specifics>

<deferred>
## Deferred Ideas

- Full TRUST-08 server-produced-key filter with a single source of truth + parity assertion ->
  Phase 5. Phase 4 ships only the cheap `nx-cache-` prefix filter (D-16). MUST close before any
  private-repo adopter enables the mirror (ADR C16).
- Write-trust widening to `pull_request`/`release` (TRUST-01) and the dependency-free action
  allowlist copy (TRUST-04) -> Phase 5.
- Consumer docs for the sync/cleanup layer and the "is the cache working" prose (DOCS-01..06) ->
  Phase 6. Phase 4 ships the SIGNAL (D-17), not the prose.
- Octokit convergence for the Phase 3 read path -> not in this phase; the reader stays on native
  `fetch` (D-04). Revisit only if a third call site appears.
- Optional LRU via a `download_count`-delta manifest -> out of scope (ADR C8; mutable retention
  state). Would only ever belong in the single-writer scheduled cleanup job.
- Per-process shard-release-ID memoization -> optional optimization at a 30-day window (D-08);
  becomes a prerequisite only if the window is ever widened.

</deferred>
