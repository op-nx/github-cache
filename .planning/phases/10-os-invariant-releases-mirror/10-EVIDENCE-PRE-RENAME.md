# Phase 10: Pre-rename evidence (perishable measurements)

**Captured:** 2026-07-29
**Commit:** `06019d4` (branch `gsd/v0.0.2-os-invariant-cross-os-sharing`, UNMERGED)
**Machine:** native Windows arm64, `process.platform=win32`, Node v24.13.0, Nx 23.1.0
**Tree:** the **MAIN tree** at `D:/projects/github/op-nx/github-cache` (`.git` is a
directory, not a file -- NOT a git worktree, so no junctioned `node_modules` is in play)

Both measurements in this file are PERISHABLE and neither is recoverable later:

- The D-25 baseline dies the moment CORR-02 lands or this branch merges to `main` (a merge
  triggers `publish`, which republishes the mirror under the new OS-free name and leaves
  every `<hash>-<os>` asset unreachable to the reader).
- The D-08 census is scoped to shard `cache-mirror-202607`, which rolls over 2026-08-01.
  Every count below names that shard tag, because a bare number is unattributable afterwards.

---

## D-25 pre-rename XOS-02 baseline

### Headline

**The pre-rename read path is PROVEN LIVE on this machine at this commit, and Nx's own
end-to-end run MISSED.** Both halves are measured, and the MISS is fully attributed to a
single cause that is neither a regression nor a read-path defect:

| Half | Result |
|---|---|
| Local Windows reader resolves a Windows-CI-produced mirror asset under the CURRENT `<hash>-<os>` name | **YES -- HTTP 200, 410 bytes**, hash `13758457399293023985` |
| Nx reports `[remote cache]` for `integration` on THIS branch's hash | **NO -- `Cache: 0/1 hit (0%)`** |
| Cause of the Nx-level MISS | This branch's four task hashes have **never been mirrored**. All four are ABSENT from every family of shard `cache-mirror-202607`. The mirror publishes only on default-branch pushes and this branch is unmerged. |

So the fresh capture CONFIRMS the pre-rename read path and does NOT reproduce an Nx-level
`[remote cache]` label. See "Disposition" below for what this means for Phase 11.

### Why a fresh capture was required at all

ROADMAP sanctions citing the existing record
`.planning/quick/260725-w3s-verify-local-development-environment-nx-/260725-w3s-STEP0-RESULTS.md`
(local Windows `[remote cache]` HIT on `integration` from a Windows-CI-produced asset,
measured 2026-07-26 at `bfd5143`). That sanction was written on 2026-07-26 -- it
**predates Phase 9's `@actions/cache` version rotation**. Citing it alone would leave
Phase 11's XOS-02 non-regression comparison straddling TWO changes (the version rotation
AND the asset rename) instead of one. Hence: fresh capture as the baseline of record, the
2026-07-26 record as the corroborating prior. D-25 locks both.

Measured consequence of the rotation on THIS path: **none.** The 2026-07-26 record's own
asset `13758457399293023985-windows` still returns 200 with the identical 410-byte payload
through the current reader. The `@actions/cache` version-hash layer governs the Actions-cache
backend, not the Releases reader, which fetches asset bytes by NAME only.

### Method: COLD-DIRECTORY variant (a recorded deviation from D-25's literal wording)

D-25 says the capture costs "one local `nx reset` + cold `integration` run behind the
sidecar". This capture used the **COLD-DIRECTORY** variant instead: `NX_CACHE_DIRECTORY`
and `NX_WORKSPACE_DATA_DIRECTORY` were pointed at fresh paths inside the session scratchpad.

Three reasons, recorded rather than taken silently:

1. It reaches the **same cold state** -- Nx has no local cache record and no workspace-data
   for any task hash, which is exactly what `nx reset` produces.
2. It keeps `git status` clean and **mutates nothing in the repo**. `nx reset` deletes the
   repo's real `.nx/cache`.
3. It **sidesteps H-5's ordering hazard entirely.** `CACHE_ARCHIVE_DIR` is the
   workspace-relative literal `.nx/cache` (comment-locked in `cache-archive-path.ts`) and is
   NOT redirected by `NX_CACHE_DIRECTORY`, so `nx reset` under a running sidecar deletes the
   directory the next `put()`'s `writeFile` needs and ENOENTs into a 500 (VER-07 / TEST-10).
   Not resetting at all removes the ordering constraint rather than merely satisfying it.

It is also the variant the cited prior record itself used (its "Repo mutation" control row:
"both `NX_CACHE_DIRECTORY` and `NX_WORKSPACE_DATA_DIRECTORY` pointed into the scratchpad").

### Measurement soundness (established BEFORE any read)

The reader degrades **every** fault to a MISS, so a HIT is self-evidencing but a MISS is
not. Control rows reuse the prior record's table shape.

| Control | Result | Which MISS cause it eliminates |
|---|---|---|
| `gh auth token` through `runHelper`'s literal spawn shape (`shell:false`, `windowsHide`, no PATHEXT resolution) | exit 0, **RESOLVES**, len 40 (length only; the value was never recorded) | "no token -> reader returns `undefined` with zero fetches" |
| `git remote get-url origin`, same spawn shape | **RESOLVES**, `https://github.com/op-nx/github-cache.git` | "no repo identity -> reader cannot compose a URL" |
| `GITHUB_ACTIONS` / `GH_TOKEN` / `GITHUB_TOKEN` / `GITHUB_REPOSITORY` | all **UNSET** | wrong-branch selection |
| `isWriteTrusted(process.env).trusted`, read from the built `dist/lib/trust.js` rather than assumed | **false** -> `selectBackend` takes the off-CI branch -> `createReleasesReadBackend(createReleasesReadClient(env))` | proves WHICH backend served the read (the Releases mirror reader, not the Actions cache) |
| Bound URL read from the sidecar's OWN stdout (`resolvePort` silently falls back on a bad PORT) | `http://127.0.0.1:41999`, matches the value in `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` | port mismatch making every task MISS |
| Wrong bearer | **401** | auth is live |
| No bearer | **401** | auth is live |
| Valid bearer, known-absent hash (`000000000000000000000000000000000000000f`) | **404** | the request reached a backend `get` (a 404 is a backend answer, not a routing failure) |
| Sidecar stderr | **0 bytes** across every probe and both Nx runs | no 401/403/429/5xx, no DNS fault, no download fault, no PUT-to-read-only-backend crash |
| `dist/serve.js` currency | `tsc --build packages/github-cache/tsconfig.lib.json` re-run at `06019d4`, exit 0, emitted nothing new (tsc's outputs-newer-than-inputs certification) | a stale bin measuring a different read path |
| Teardown | listening PID stopped; `Get-NetTCPConnection -LocalPort 41999 -State Listen` returns nothing; `curl` exit 7 | a leaked sidecar |
| Repo mutation | `git status --porcelain packages/ .github/ start-cache-server/` printed **nothing** | this plan edited no source |

### Verbatim transcript

Sidecar launch (the shipped consumer surface, launched directly; token is a locally
generated throwaway, never recorded here):

```
PORT=41999 NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<throwaway> \
  node packages/github-cache/dist/serve.js
```

Sidecar's own stdout, first line:

```
github-cache serve listening on http://127.0.0.1:41999
```

Cold `integration` run (fresh `NX_CACHE_DIRECTORY` + fresh `NX_WORKSPACE_DATA_DIRECTORY`,
`NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:41999`):

```
npx nx run @op-nx/github-cache:integration
```

Verbatim Nx output lines (ANSI stripped, otherwise byte-for-byte):

```
> nx run @op-nx/github-cache:integration

> vitest run --config vitest.integration.config.mts

 RUN  v4.1.10 D:/projects/github/op-nx/github-cache/packages/github-cache

 [OK] |@op-nx/github-cache:integration| src/server/public-server.integration.spec.ts (3 tests) 53ms

 Test Files  1 passed (1)
      Tests  3 passed (3)

 NX   Successfully ran target integration for project @op-nx/github-cache

  Run duration:      961ms
  Cache:             0/1 hit (0%)
```

**There is NO `[remote cache]` marker on the task line.** `[remote cache]` is the only
discriminating label, and `Cache: 0/1 hit (0%)` is Nx's own end-of-run confirmation. The
task really executed (real 53ms vitest run, 961ms run duration) against the prior record's
1ms replay.

A second cold run over all four cacheable targets, to widen the matrix:

```
npx nx run-many -t build typecheck test integration -p @op-nx/github-cache
```

```
 NX   Successfully ran targets build, typecheck, test, integration for project @op-nx/github-cache

  Run duration:      2.4s
  Cache:             0/4 hit (0%)
```

All 675 unit tests and all 3 integration tests passed. No target failed, so the
`08-nx-task-hash-parity/deferred-items.md` unattributed `test` failure did not recur here.

### Direct read-path probe (what discriminates the causes)

Each hash below was requested through the sidecar with a valid bearer, so a 404 is a
backend answer and not a routing fault (the control table's 401/404 pair establishes that).

| Target / source | Hash | Reader asked for | HTTP | Bytes |
|---|---|---|---|---|
| `integration`, local COLD at `06019d4` | `7907925174069363349` | `<hash>-windows` | **404** | 0 |
| `build`, local COLD at `06019d4` | `6003176940154186566` | `<hash>-windows` | **404** | 0 |
| `test`, local COLD at `06019d4` | `7182296270484722806` | `<hash>-windows` | **404** | 0 |
| `typecheck`, local COLD at `06019d4` | `13957212300839184279` | `<hash>-windows` | **404** | 0 |
| **`integration`, the 2026-07-26 prior record's hash** | **`13758457399293023985`** | `<hash>-windows` | **200** | **410** |

The last row is the load-bearing one. It is the SAME asset
`13758457399293023985-windows` the 2026-07-26 record HIT, still present in the shard, still
served with the identical 410-byte payload, through the CURRENT `<hash>-<os>` naming, on
this machine, at this commit. **The pre-rename read path works.**

### Attribution of the MISS -- which control eliminates which cause

The prior record's MISS taxonomy has four candidate causes. Three are eliminated by
measurement and one is confirmed:

| Candidate cause | Status | Eliminating evidence |
|---|---|---|
| No token resolved | **ELIMINATED** | `gh auth token` RESOLVES (len 40) through the reader's own spawn shape |
| No repo identity resolved | **ELIMINATED** | `git remote get-url origin` RESOLVES |
| Sidecar unreachable / port or token mismatch / wrong backend branch | **ELIMINATED** | bound URL read from the sidecar's own stdout and equal to the client var; 401 on a wrong bearer; 404 on a valid bearer; `isWriteTrusted` false so the Releases reader was the backend; stderr 0 bytes; and a **200 on a different hash through the same path in the same session** |
| Nothing published under the reader's naming scheme for these hashes | **CONFIRMED, and it is the sole remaining cause** | All four locally computed hashes are **ABSENT from every family** of shard `cache-mirror-202607` (cross-checked against the full 122-asset name list in the census below), while the prior record's hash IS present and DOES serve |

Why the four hashes were never mirrored, stated plainly so Phase 11 does not re-derive it:
`publish` runs on default-branch pushes. Branch `gsd/v0.0.2-os-invariant-cross-os-sharing`
is UNMERGED, so no push has ever mirrored a hash computed from this branch's tree. This is
expected behaviour, not a fault -- and it is exactly why the prior record's HIT was measured
at `bfd5143`, a **merge commit on `main`**.

### Disposition -- what Phase 11's XOS-02 inherits

**NOT flagged as an OPEN BLOCKER against the read path.** The plan's MUST-NOT is "record a
HIT that was not observed"; it is honoured -- no HIT is claimed for Nx at `06019d4`. But the
MISS is NOT evidence of a read-path defect, and recording it as a blocker against the reader
would be the mirror-image error: the 200 on `13758457399293023985` refutes that reading
inside the same session, on the same machine, through the same process.

What Phase 11 inherits, precisely:

1. **Pre-rename read-path baseline (fresh, this capture, `06019d4`):** a local Windows
   reader resolves a Windows-CI-produced mirror asset under `<hash>-<os>` -> HTTP 200,
   410 bytes. This is the baseline of record for "the reader reaches the mirror".
2. **Pre-rename Nx-level `[remote cache]` baseline:** the 2026-07-26 record at `bfd5143`
   remains the ONLY Nx-level pre-rename HIT, and it is now also the only one there will
   ever be, because the window closes at the rename. Phase 11 must cite it for the
   Nx-consumption half.
3. **OPEN PRECONDITION for XOS-02 (this is the real gate, and it is a precondition, not a
   defect):** a post-rename Nx-level `[remote cache]` HIT cannot be measured from a
   developer machine until a **default-branch push has republished the mirror under the new
   OS-free name**. That precondition is already this phase's third Live-CI `human_needed`
   item. Until it lands, any local post-rename read MISSES for the same single cause
   measured here -- absent asset, not a broken reader -- and must not be misread as an
   XOS-02 regression.
4. **A calibrated instrument.** The 401 / 404 / 200 triple plus `isWriteTrusted` false is
   the control set that makes a post-rename MISS attributable. Phase 11 should re-run the
   identical triple; without it, a post-rename MISS is indistinguishable from a
   read-path regression.

---

## Provenance

| Fact | Value |
|---|---|
| Commit | `06019d4` |
| Branch | `gsd/v0.0.2-os-invariant-cross-os-sharing` (unmerged) |
| Tree | MAIN tree, not a git worktree (no junctioned `node_modules`) |
| Node | v24.13.0 |
| Nx | 23.1.0 |
| Vitest | 4.1.10 |
| Platform | win32, arm64 |
| Asset naming in effect | `<hash>-<os>` (pre-CORR-02); `release-asset-name.ts:54` returns `` `${hash}-${cachePlatform(platform)}` `` |
| Source files changed by this capture | **none** (`git status --porcelain packages/ .github/ start-cache-server/` printed nothing) |
| Corroborating prior | `.planning/quick/260725-w3s-verify-local-development-environment-nx-/260725-w3s-STEP0-RESULTS.md` (2026-07-26, `bfd5143`) |
