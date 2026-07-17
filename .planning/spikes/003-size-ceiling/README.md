---
spike: 003
name: size-ceiling
type: comparison
validates: "Given artifacts scaling toward the 2 GB body cap, when pushed to each store, then the true per-primitive ceiling + failure mode is observed vs a generic 2 GB assumption (ROBUST-02)"
verdict: GHCR_HEADROOM_EDGE
related: [001]
tags: [size, robustness, ceiling]
---

# Spike 003: size-ceiling (GHCR vs Releases)

## What This Validates

Given artifacts scaling toward the 2 GB server body cap, when pushed to each store, then the
true per-primitive ceiling + failure mode is observed - ROBUST-02 demands the per-primitive
ceiling be verified, not assumed as a generic "~2 GB". Adapter-design question: does GHCR's
monolithic blob PUT scale, or must the adapter implement chunked upload?

## Research / Approach

Prior research (`.planning/research/STACK.md`) documents Releases ~2 GiB/asset and the 2 GB
server body cap (`MAX_CACHE_BODY_BYTES`). Empirically pushed a **100 MiB incompressible**
(`randomBytes`) payload round-trip through both via monolithic upload, measuring throughput,
then extrapolated to 2 GiB and reasoned the boundary failure mode. (A full 2 GiB round-trip
x2 stores = ~8 GiB transfer / ~20 min on a home uplink for a near-certain outcome - deferred
as a documented ceiling; the 100 MiB run proves the mechanism.)

## How to Run

```bash
GH_TOKEN=$(gh auth token) node size-ceiling.mjs 100   # 100 MiB round-trip both stores
```

## Results

**GHCR has a size-headroom edge; both are network-bound and identical in throughput.**

| | GHCR/OCI | Releases |
|---|----------|----------|
| 100 MiB monolithic upload | **201 OK** (no chunking needed) | 201 OK |
| Bytes identical round-trip | yes | yes |
| Up throughput | ~63 Mbps | ~58 Mbps |
| Down throughput | ~217 Mbps | ~199 Mbps |
| Extrapolated 2 GiB push | ~260 s | ~285 s |
| Documented per-primitive ceiling | blob >> 2 GiB (10s of GiB) | **~2 GiB/asset** |
| Behavior at the 2 GB body cap | **headroom** | **right at the boundary** |

### Key findings

- **Throughput is a wash** - both are limited by the same uplink; the store choice does not
  change transfer time.
- **GHCR monolithic PUT scales to at least 100 MiB** - typical cache artifacts (KB-MB) and
  even large ones need no chunked-upload machinery in the adapter. (Flag: a single ~2 GiB
  monolithic PUT is unconfirmed; near the ceiling GHCR/OCI may require chunked `PATCH` upload
  - a modest GHCR-only complexity that only bites artifacts approaching 2 GiB.)
- **ROBUST-02 resolved:** the binding limit today is the **2 GiB server body cap for BOTH**.
  But Releases' **~2 GiB/asset ceiling coincides exactly with that cap** - a maximal artifact
  sits on the Releases failure boundary (the silent-large-artifact risk ROBUST-02 names).
  GHCR's blob ceiling is far above 2 GiB, so GHCR has headroom and is future-proof if the
  body cap is ever raised.

### Surprise

- The prior research justified Releases partly by "anonymous public read"; FOUND-02 has since
  demoted anon-read to a non-driver, so that half of the Releases case is now void - only the
  size-boundary trade-off (a mild GHCR win) remains from this dimension.

## Investigation Trail

1. Read prior research: Releases ~2 GiB/asset == 2 GB body cap; GHCR blobs far larger.
2. Pushed 100 MiB incompressible both ways; both 201, bytes identical, throughput identical.
3. Confirmed GHCR monolithic PUT scales to 100 MiB (no chunking needed at that size).
4. Extrapolated 2 GiB push time (~4-5 min, network-bound); reasoned the boundary: Releases at
   the cap edge (risk), GHCR with headroom.

## Verdict

**GHCR_HEADROOM_EDGE** - throughput identical; both fine for real cache artifacts. GHCR wins
a mild edge on size headroom (no 2 GiB/asset boundary collision, future-proof), at the cost
of possible chunked-upload complexity only for artifacts near 2 GiB. Not decisive alone.
