---
spike: 005
name: cross-os-roundtrip
type: standard
validates: "Given an OS-invariant and an OS-sensitive hash produced on ubuntu + windows CI, when round-tripped through each store, then a cross-OS hit never serves a wrong-OS artifact (CORR-01 / Decision 6); plus CI-side latency and the in-repo GITHUB_TOKEN cleanup capability (C11)"
verdict: CORR01_STORE_AGNOSTIC + C11_SOFTENED
related: [001, 004]
tags: [cross-os, correctness, ci, cleanup, credential]
---

# Spike 005: cross-os-roundtrip (CI leg)

## What This Validates

Three CI-only questions, on an ubuntu + windows matrix inside GitHub Actions:
1. **CORR-01 / Decision 6:** does a cross-OS HIT ever serve a wrong-OS artifact, and is
   OS-namespacing a sufficient, store-agnostic mitigation?
2. **CI-side latency** for both stores (from GitHub's own runners), to complement the local
   head-to-head in 001.
3. **C11 / RETAIN-03:** can the repo's `GITHUB_TOKEN` (`packages: write`) delete a GHCR
   package version - the escape from 004's finding that a user PAT needs `delete:packages`?

## How to Run

Workflow `found01.yml` (dispatched in `LayZeeDK/found01-spike`): job `cross-os`
(matrix ubuntu+windows) runs `ci-roundtrip.mjs`; job `ghcr-cleanup-token` runs
`ci-ghcr-cleanup.mjs`. Run 29613149528 - all jobs green.

## Results

### 1. CORR-01 cross-OS (both OSes, both stores)

| Check | ubuntu | windows |
|-------|--------|---------|
| OS-invariant round-trip (GHCR + Releases) | ok | ok |
| OS-namespaced OS-sensitive round-trip (GHCR + Releases) | ok | ok |
| Non-namespaced key serves last-writer (wrong-OS hazard) | **true** | **true** |
| OS-namespacing isolates by OS | **true** | **true** |

**The wrong-OS-hit hazard is real and store-agnostic.** A non-namespaced key returns whatever
was written last - a Linux reader can get Windows bytes (a wrong result, not a MISS). **Both
GHCR and Releases behave identically**; neither prevents it, and OS-namespacing the key fixes
it for both. CORR-01 is validated and is **not a differentiator** between the two readers.

### 2. CI-side latency (2 artifacts push / 2 reads per run)

| | GHCR push | GHCR read | Releases push | Releases read |
|---|-----------|-----------|---------------|---------------|
| ubuntu | 4692 ms | 1286 ms | 1021 ms | 912 ms |
| windows | 2369 ms | 921 ms | 1007 ms | 554 ms |

Consistent with the local head-to-head: **Releases is faster per operation** (fewer calls per
op, no per-reader token exchange); GHCR push is heavier (3 blobs, though the `{}` config blob
dedups via `HEAD`). Both are well within acceptable cache latency from CI.

### 3. C11 cleanup credential - softens 004

- `delete_user_scope: status 204, ok: true` -> **the repo `GITHUB_TOKEN` (`packages: write`)
  successfully deleted a package version** via `/users/{owner}/packages/container/{pkg}/versions/{id}`.
- Notable: the package reported `visibility=private` and `repository=UNLINKED`, yet deletion
  still succeeded - because the package **owner == the repo owner** (personal account) and the
  `GITHUB_TOKEN`'s `packages: write` grants delete on that owner's packages.
- This is **more capable than a user PAT's `write:packages`** (which 403'd in 004 for lack of
  `delete:packages`). So GHCR cleanup with **no long-lived PAT is feasible for the common
  same-owner case**. The classic-PAT requirement (C11) narrows to **org-owned / cross-owner /
  not-granted** packages, and fine-grained PATs remain unsupported for GHCR deletion.

## Investigation Trail

1. Built a matrix workflow round-tripping an OS-invariant + an OS-namespaced OS-sensitive key
   through both stores, plus a deterministic non-namespaced collision demo.
2. Both OSes: all round-trips ok; collision confirmed on non-namespaced keys; namespacing fixes
   it - identically for GHCR and Releases.
3. Cleanup job: `GITHUB_TOKEN` deleted a same-owner package version (204) - contradicting the
   pessimistic read of 004; refined C11 to same-owner (GITHUB_TOKEN ok) vs org/cross-owner (PAT).

## Verdict

**CORR01_STORE_AGNOSTIC + C11_SOFTENED** - cross-OS correctness is a wash (OS-namespacing
required for whichever store wins); CI latency mirrors local (mild Releases edge); and the
GHCR cleanup-credential burden is smaller than 004 implied for same-owner packages, though
still larger than the Releases path (which uses the same `contents:write` token to publish and
clean up, with no owner/linkage nuance).
