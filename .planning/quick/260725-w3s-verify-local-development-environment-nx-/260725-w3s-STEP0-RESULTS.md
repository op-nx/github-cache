# Quick Task 260725-w3s: STEP 0 RESULTS (post-merge re-measurement)

**Measured:** 2026-07-26
**Commit:** `bfd5143` (merge of PR #4 into `main`)
**Machine:** native Windows (arm64), `process.platform=win32`
**Predecessor:** `260725-w3s-RESULTS.md` measured the SAME question pre-merge and got all-MISS.

## Headline

**A local Windows developer now gets a genuine remote cache HIT for `integration`** through the
shipped v0.0.1 surface, and **correctly MISSES** the OS-independent targets whose only published
assets are Linux-keyed. Both halves are what v0.0.1 specified.

This closes the one v0.0.1 promise that had never been exercised from a developer machine.

## Why the scope narrowed from four targets to one

The pre-merge measurement treated all four cacheable targets as open questions. Reading the
v0.0.1 artifacts settles three of them without measuring anything:

| Case | v0.0.1 intent | Source |
|---|---|---|
| OS-agnostic cache records | **Do not exist, by design.** The store is OS-namespaced *by default*; `releaseAssetName` appends the platform unconditionally. | REQUIREMENTS `:66` (CORR-01), ROADMAP SC2 `:277-280` |
| OS-specific cache records | The only shape. Intended, shipped, CI-verified. | Phase 3 VERIFICATION SC2; Phase 4 `live_proof_confirmed` (run 29726834220) |
| Local Windows read of `build`/`typecheck`/`test` | **Intended to MISS.** "a Linux-produced entry is never served to a Windows reader"; TEST-05 asserts "a correct hit or a MISS -- never a wrong-OS artifact". | ROADMAP SC2 `:277-280`, SC3 `:282-284` |
| Local Windows read of `integration` | **Intended to HIT** -- and verified only structurally, never live from a dev box. | FOUND-02 `:20`, ROADMAP SC1 `:273-275` |

Phase 3 marked SC1 VERIFIED on `selectBackend` wiring, the three-tier auth chain, and a
spec-level end-to-end test. Phase 4's live proof was **CI-to-CI**: `publish-verify` reads back
inside the runner, each leg logging `cache HIT for <run_id> on <platform>` -- same-OS per leg.
No developer-machine read was ever exercised against real GitHub infrastructure.

## Measurement soundness (established BEFORE any read, per D-11)

The reader degrades every fault to a MISS, so a HIT is self-evidencing but a MISS is not. All
controls recorded:

| Control | Result |
|---|---|
| `gh auth token` through `runHelper`'s literal spawn shape (`shell:false`, no PATHEXT resolution) | exit 0, non-empty, **RESOLVES** (length only; value never recorded) |
| `git remote get-url origin`, same shape | exit 0, **RESOLVES**, `https://github.com/op-nx/github-cache.git` |
| `GITHUB_ACTIONS` / `GH_TOKEN` / `GITHUB_TOKEN` / `GITHUB_REPOSITORY` | all **UNSET** -> off-CI branch -> Releases reader |
| Bound URL read from the sidecar's own stdout (`resolvePort` silently falls back on a bad PORT) | `http://127.0.0.1:41999`, matches the client var |
| Wrong bearer | **401** (auth live) |
| Valid bearer, known-absent hash | **404** (request reached a backend `get`) |
| `dist/serve.js` currency | rebuilt at `bfd5143`; output byte-identical, so the merge touched no `serve()`-reachable source (closes w3s gap A3) |
| Sidecar stderr | **0 bytes** across every probe -- no 401/403/429/5xx, no DNS or download fault |
| Teardown | `curl` exit 7, `Get-NetTCPConnection -LocalPort 41999` returns nothing |
| Repo mutation | `git status` clean; both `NX_CACHE_DIRECTORY` and `NX_WORKSPACE_DATA_DIRECTORY` pointed into the scratchpad |

## The mirror after one real `main` push

Run `30180166604` on `bfd5143` was the first run with all 17 jobs executing (zero skipped);
`publish` ran on both OS legs. Mirror went 79 -> 87 assets in shard `cache-mirror-202607`:

| Shape | Count | Reader-reachable |
|---|---|---|
| PoC-era `<hash>.tar.gz` | 50 | No -- reader asks for `<hash>-<os>`, no extension |
| `<run_id>-<os>` seeds | 26 | No -- run-id keyed, not task hashes |
| `<taskhash>-<os>` | **5** | **Yes** |

None of the 5 has both OS variants. 4 are `-linux`, 1 is `-windows`.

## Direct read-path probe

| Hash | w3s identity | Published | HTTP | Bytes |
|---|---|---|---|---|
| `13758457399293023985` | `integration`, COLD | `-windows` | **200** | 410 |
| `14522047022641658505` | `build`, WARM | `-linux` only | 404 | 0 |
| `12332927989897543193` | `test`, WARM | `-linux` only | 404 | 0 |

The 200 body is real: gzip magic `1f8b08`, 3584 bytes uncompressed, tar entries
`terminalOutput` + `code` (the Nx cache-entry shape), contents referencing
`vitest.integration.config.mts`, `src/server/public-server.integration.spec.ts` and the
`integration` target.

The two 404s are **CORR-01 demonstrated live** against real infrastructure, not just the
Phase 3 injected-fake negative test: a Windows reader asking for a hash whose only published
asset is `-linux` gets a clean MISS.

## End-to-end Nx probe (the acceptance signal)

The direct probe proves the READER resolves the asset. It does not prove Nx's client consumes
it -- that was w3s advisory gap A2. Closed here. COLD state (fresh cache dir + fresh
workspace-data), `nx run @op-nx/github-cache:integration`:

```
> nx run @op-nx/github-cache:integration  [remote cache]
Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
Cache: 1/1 hit (100%)
Run duration: 1ms
```

`[remote cache]` is the only discriminating label (RESEARCH 4a). Two independent
corroborations:

1. **Run duration 1ms** against the test's real 554ms.
2. **The replayed `terminalOutput` carries `C:/a/github-cache/github-cache/packages/github-cache`**
   -- a GitHub *runner* workspace path, not this machine's `D:\projects\github\op-nx\github-cache`.
   The artifact demonstrably originated on a Windows CI runner and was consumed locally. This is
   the cross-context transfer FOUND-02 is about, evidenced by the payload itself.

## Incidental finding: hash parity holds for `integration` on Windows

The CI-published asset name encodes the CI-computed hash. `13758457399293023985-windows` was
written by the Windows leg at `bfd5143`; w3s measured `13758457399293023985` as the COLD
`integration` hash locally at `e436206`; and this task's COLD local run HIT that key at
`bfd5143`. So local-cold-Windows == CI-Windows for `integration`, across two commits.

This is a genuine parity data point and it is narrow: it says nothing about `build` /
`typecheck` / `test`, whose Windows-keyed assets do not exist to test against.

## What is still NOT tested

- **Cross-OS hits for `build`/`typecheck`/`test`.** Not a gap -- v0.0.1 specifies the MISS, and
  it is now demonstrated live. Changing it means taking CORR-01's *second* branch (namespace only
  non-portable outputs, document + enforce the rest), which is a design change to a LOCKED
  requirement, not a patch.
- **Why the Windows publish leg mirrored only one task-hash asset** while the Linux leg mirrored
  four. Observed, not explained. Do not guess at it.
- **The `@actions/cache` version-hash layer.** Still untouched; the keys have never collided.
- **macOS.** `cachePlatform` maps `darwin -> macos` and is unit-pinned, but no macOS runner or
  developer read exists.

## Effect on the w3s outcome label

The pre-merge all-MISS was attributed to cause (1), nothing published in the reader's naming
scheme. That attribution is now confirmed by its own repair: once real task-hash assets exist,
the same read path on the same machine HITs.

Whether that makes 260725-w3s a PASS or a FAIL remains the maintainer's decision. It is recorded
here that the evidence which was missing at deferral time now exists, and that the target
v0.0.1 intended to hit does hit. This file does not choose the label.
