# Spike Manifest

## Idea

FOUND-01: choose the reader / cross-context storage adapter for `@op-nx/github-cache`
(the Nx remote cache) between **GHCR/OCI** and **GitHub Releases**. The Actions cache is
the decided CI-RW default; git-native and Actions artifacts are out. Decide on **forward
merits only** - the current Releases implementation is a spike/PoC (sunk cost = 0). The
paper unknowns (GHCR atomic create-if-absent unavailable/low-severity; write-trust backstop
host-detected fail-closed; Nx PUT floor a hard 200) are resolved and must NOT be reopened.
This spike produces a **symmetric** operational + security failure ledger for both readers.

Canonical scope: `.planning/ARCHITECTURE-DECISION.md` (Decision 3 + control ledger C1-C18)
and `.planning/REQUIREMENTS.md` (FOUND-01 rubric).

## Requirements

Symmetric forward-merits rubric (from FOUND-01):

- Authenticated **private** keyed lookup (MUST work; anon/public is optional convenience - FOUND-02)
- CI + local read/write latency
- Cost incl. free-tier durability
- Cold-read API fan-out vs the 60/hr anon + 5000/hr auth limits
- First-write-wins / no-overwrite enforceability (resolved on paper: GHCR best-effort, low-severity)
- Content-addressing / digest-pin (pull-by-digest mandatory iff GHCR - C6)
- Ongoing control-surface count
- Per-primitive size ceiling (ROBUST-02) vs the 2 GB body cap
- Poison-remediation capability
- Docker-distribution synergy
- Cross-OS round-trip: a cross-OS hit must never serve a wrong-OS artifact (CORR-01 / Decision 6)

GHCR-side burdens: >5000-download-undeletable wall; untagged child-manifest cleanup;
mutable tags -> pull-by-digest; cleanup credential (classic PAT for org-owned/unlinked).
Releases-side burdens: 1000 assets/release (sharding); ~2 GiB/asset ceiling vs the 2 GB body cap.

## Test targets

- Throwaway private hub repo: `LayZeeDK/found01-spike` (Releases private leg, in-repo GHCR
  package cleanup proof, CI matrix workflows). Safe to delete.
- GHCR packages: `ghcr.io/layzeedk/found01-*` via the OCI registry HTTP API (no docker daemon).
- Cleanup needs `delete:packages` + `delete_repo` scope refreshes (surfaced at end).

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001a | ghcr-oci-roundtrip | comparison | Private keyed lookup by digest via OCI registry API, authenticated, byte-identical, latency | VALIDATED | ghcr, oci, reader |
| 001b | releases-roundtrip | comparison | Release-asset keyed lookup, authenticated private + public, byte-identical, latency | VALIDATED | releases, reader |
| 002 | cold-read-fan-out | comparison | API-call fan-out per `nx affected` cold read vs 60/hr anon + 5000/hr auth | WASH (required case); GHCR edge for anon-public | rate-limit, reader |
| 003 | size-ceiling | comparison | True per-primitive size ceiling + failure mode vs the 2 GB body cap (ROBUST-02) | GHCR headroom edge (mild) | size, robustness |
| 004 | ghcr-hazards | standard | Child-manifest cleanup, cleanup credential (GITHUB_TOKEN vs PAT), overwrite, >5000 gap | GHCR carries real cleanup burden (strongest pro-Releases dim) | ghcr, cleanup, security |
| 005 | cross-os-roundtrip | standard | Cross-OS round-trip (OS-invariant + OS-sensitive hash) from ubuntu + windows CI | CORR-01 store-agnostic (OS-namespace fixes both); C11 GITHUB_TOKEN deletes same-owner pkg | cross-os, correctness, ci |
