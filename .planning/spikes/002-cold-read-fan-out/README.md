---
spike: 002
name: cold-read-fan-out
type: comparison
validates: "Given an nx-affected cold read of K distinct hashes, when resolved against each store, then the measured API-call fan-out stays under the rate-limit pools (60/hr anon + 5000/hr auth REST; GHCR registry is a separate pool)"
verdict: WASH_FOR_REQUIRED_CASE
related: [001]
tags: [rate-limit, reader, fan-out]
---

# Spike 002: cold-read-fan-out (GHCR vs Releases)

## What This Validates

Given an `nx affected` cold read of K distinct hashes (most of which MISS on a cold cache),
when resolved against each store, then the measured HTTP-call fan-out stays under the
rate-limit pools. The worry going in: GHCR might need per-hash manifest+blob fetches with no
amortization, blowing the rate limit that the Releases shard-map cache avoids.

## Research / Approach

Populated N present entries + requested N present + M absent hashes against each store, with
an instrumented `fetch` that counts calls per pool. GHCR read uses the **bulk strategy**
(`GET /v2/name/tags/list`, Link-header paginated - the OCI equivalent of the Releases
month-shard asset map) so misses are free, then manifest+blob per hit. Releases read is
exactly `release-mirror-backend.ts`: `getReleaseByTag` -> paginated `listReleaseAssets`
(shard map, misses free) -> `downloadAsset` per hit.

## How to Run

```bash
GH_TOKEN=$(gh auth token) node fanout.mjs 8 20   # N=8 hits, M=20 misses
```

## Results

**WASH for the required (authenticated-private) case; slight GHCR edge only for the optional
anon-public case.** Measured (N=8 hits, M=20 misses):

| | GHCR/OCI | Releases |
|---|----------|----------|
| Bulk existence map | `tags/list` (Link-paginated) - **works** | shard asset map (paginated) |
| Misses cost extra calls | **no** (0 per miss) | **no** (0 per miss) |
| Calls per hit | 2 (manifest + blob) | 1 (download) |
| Measured cold-read calls (8 hits) | 19 registry + 1 token = 20 | 10 REST |
| Rate-limit pool | **separate registry pool** (no REST headers) | **REST** (60/hr anon, 5000/hr auth) |
| Cold-read latency (8 hits, serial) | ~6.0 s | ~3.6 s |
| Populate latency (8 entries) | ~17 s (3 blobs/entry) | ~4.2 s |

### Projection to a real `nx affected` (K=200 requested, 40 hits, 400 total entries, 2 shards)

- **GHCR:** `1 token + ceil(400/100) tag-list pages + 2*40 hits` = ~85 registry calls, **0 REST calls**.
- **Releases:** `2 shards*(1 + ceil(400/100) pages) + 40 hits` = ~50 REST calls (against 5000/hr auth).

### Key findings

- **The GHCR per-hash-fan-out fear is disproved.** `tags/list` amortizes exactly like the
  shard map; both stores make misses free. GHCR is **not** eliminated on fan-out.
- **Required case (authenticated private, FOUND-02) = a wash.** ~50 REST calls/session is
  trivial against 5000/hr; ~85 GHCR registry calls is trivial against the (higher, opaque)
  registry pool. Neither store is rate-constrained when authenticated.
- **Optional case (anonymous public) favors GHCR.** Every Releases read is a REST call
  against the **60/hr** anon limit - a single cold `nx affected` (~40-50 calls) nearly
  exhausts it, and the shard cache only helps within one long-lived `serve` process. GHCR
  anon container pulls draw the separate registry pool (documented higher for anon pulls).
  But anon-public is an explicit **non-driver** (FOUND-02: private auth required, anon
  optional), so this edge is a tiebreaker at best.
- Releases is **fewer calls and lower latency per hit** (1 vs 2), and its calls are cheap
  REST; GHCR needs a per-reader token exchange (~0.3 s once) and 2 registry calls/hit.

### Surprises

- GHCR `tags/list` honored `?n=` and emitted a proper `Link: ...; rel="next"` header -
  clean, spec-compliant pagination. (Page-size cap not observable at N=8; projection assumes
  the OCI-typical 100 max - **flag: confirm at >100 tags before relying on it at scale**.)
- GHCR registry responses expose **no** `RateLimit`/`X-RateLimit`/`Retry-After` headers,
  reinforcing that the registry is a distinct subsystem from the REST 60/5000 pool.

## Investigation Trail

1. Feared GHCR per-hash fan-out (2-3 calls * K) with no bulk map -> would blow rate limits.
2. Probed `tags/list`: works, Link-paginated -> GHCR HAS a bulk map. Fear disproved.
3. Instrumented both cold reads; confirmed misses are free in both, per-hit 2 (GHCR) vs 1
   (Releases), pools distinct.
4. Projected to K=200: both trivially under their pools when authenticated.

## Verdict

**WASH_FOR_REQUIRED_CASE** - fan-out does not decide FOUND-01. Both amortize; both are far
under their rate-limit pools for the required authenticated-private case. GHCR wins the
optional anon-public convenience on rate limits; Releases is marginally cheaper/faster per
authenticated hit. Not a differentiator. (Flag: confirm GHCR tag-list page cap at >100 tags.)
