---
spike: 001
name: reader-round-trip
type: comparison
validates: "Given a cache tarball keyed by an Nx hash, when published to a private GHCR OCI artifact (001a) or a private Release asset (001b) and read back authenticated, then the exact bytes return - proving authenticated private keyed lookup for both readers"
verdict: BOTH_VALIDATED
related: [002, 003, 004]
tags: [ghcr, oci, releases, reader]
---

# Spike 001: reader-round-trip (GHCR/OCI vs Releases)

## What This Validates

Given a cache tarball keyed by an Nx hash, when published to a **private** GHCR OCI
artifact (001a) or a **private** Release asset (001b) and read back with the developer's
`gh` token, then the exact bytes return - authenticated private keyed lookup works for
both readers, with no anonymous dependency (FOUND-02). GHCR is pulled **by digest** (C6).

## Research / Approach

- **GHCR (001a):** driven via the **OCI distribution HTTP API directly** (`ghcr.io/v2/...`),
  dependency-free Node with global `fetch` - no docker daemon. This is the exact mechanism a
  real adapter would use and gives precise latency. Token flow: `Basic <user:gh-token>` ->
  `GET /token?scope=repository:<name>:pull,push` -> registry bearer. Push = blob upload
  (POST session + PUT with `?digest=`) x layer + config, then `PUT /manifests/<tag>` with
  `tag == nxHash` (C6). Pull-by-digest = `GET /manifests/<sha256>` then `GET /blobs/<layer>`.
- **Releases (001b):** raw REST making the SAME calls `release-mirror-backend.ts` makes:
  `GET /releases/tags/<tag>` -> paginated `GET /releases/<id>/assets` -> `GET /releases/assets/<id>`
  with `Accept: application/octet-stream`. Asset name = `<hash>.tar.gz`.
- Both: 256 KiB gzipped random payload (representative small cache entry), tag/asset derived
  from `sha256(content+nonce)` for Nx-hash shape parity.

## How to Run

```bash
GH_TOKEN=$(gh auth token) node ghcr-oci-roundtrip.mjs layzeedk found01-oci run-$(date +%s)
GH_TOKEN=$(gh auth token) node releases-roundtrip.mjs LayZeeDK found01-spike spike-found01 run-$(date +%s)
```

## Results

**BOTH VALIDATED.** Byte-identical round-trip on both; both reject anonymous reads of a
private target; both prove authenticated private keyed lookup (FOUND-02 satisfied by both).

### Head-to-head (local, Windows arm64, 256 KiB artifact)

| Dimension | GHCR/OCI (001a) | Releases (001b) |
|-----------|-----------------|-----------------|
| Round-trip byte-identical | yes (3/3 pulls) | yes (3/3 reads) |
| Layer/asset digest verified | yes (`sha256(blob)` == layer digest) | yes (`sha256` match) |
| Private authed read | yes | yes |
| Anon read of private target | **401** (blocked) | **404** (blocked; hides existence) |
| Publish latency | ~3.2 s (layer 1.85s + config 0.89s + manifest 0.49s) | ~0.9 s upload (release pre-existing) |
| Read latency (warm, keep-alive) | ~0.54 s median (2 GETs) | ~1.05 s median (3 API calls + CDN) |
| Read latency (cold, fresh proc) | ~0.9-1.2 s (incl. ~0.3 s token exchange) | ~1.05 s |
| Content addressing | native OCI digest; pull-by-digest (C6) | asset name `<hash>.tar.gz` |
| Tag == hash lookup | works (tag resolves to same manifest digest) | tag = month shard; name = hash |

### Key findings / surprises

- **GHCR publish is ~3x heavier** because an OCI artifact is 3 blobs (layer + config +
  manifest), each ~2 round-trips (POST session + PUT). But **blob reuse is cheap**:
  `HEAD /blobs/<digest>` skips re-upload of an already-present layer. Releases publish is a
  single asset POST (plus a one-time release create).
- **GHCR read is faster warm** (2 GETs) but carries a **per-reader token-exchange** cost
  (~0.3 s, once) that Octokit/Releases does not - Octokit uses the GitHub token directly.
- **New personal GHCR package defaults to `visibility=private`** (fail-closed; good for C18)
  and is **`repo=UNLINKED`** when pushed to a personal namespace via the API - a package
  not linked to a repo cannot be managed by a repo-scoped `GITHUB_TOKEN` (feeds RETAIN-03/C11,
  investigated in 004).
- A single-manifest push produced **no untagged child manifest** - child manifests come from
  multi-arch **index** pushes (docker buildx), investigated in 004.
- **CREEP-safe GHCR read nuance (-> 002/security ledger):** to pull strictly by digest given
  only a hash you must first `HEAD /manifests/<hash>` for the `Docker-Content-Digest` (3 calls
  total), OR pull the manifest by tag and verify the layer blob's sha against `layers[0].digest`
  (2 calls). Mutable-tag substitution is contained by the write gate (C1/C2), so tag-then-verify
  is acceptable; pull-by-digest (C6) is defense-in-depth.

## Investigation Trail

1. Built the GHCR OCI-API round-trip; first run passed clean (bytes identical x3, anon 401).
2. Depth check: confirmed package `visibility=private`, `repo=UNLINKED`, one tagged version,
   zero untagged children. Flagged the unlinked-package cleanup implication for 004.
3. Measured true cold pull (fresh process): token exchange ~0.3 s + manifest+blob ~0.6-0.9 s.
4. Built the Releases round-trip; first run failed `422 Repository is empty` -> seeded the
   throwaway repo with one commit; re-ran clean (bytes identical x3, anon 404).
5. Compared: both viable for authenticated private keyed lookup; publish/read latency and
   the fan-out amortization difference (shard map vs per-hash) carried into 002.

## Verdict

**BOTH_VALIDATED** - authenticated private keyed lookup works for GHCR and Releases; neither
is eliminated on the core round-trip. The decision moves to fan-out (002), size (003), GHCR
operational hazards (004), and cross-OS correctness (005).
