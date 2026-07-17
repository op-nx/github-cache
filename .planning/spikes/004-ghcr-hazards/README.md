---
spike: 004
name: ghcr-hazards
type: standard
validates: "Given a published GHCR package, when a tag is overwritten and a version deletion is attempted with a write:packages token, then the mutable-tag/orphan behavior and the minimal cleanup credential are established (RETAIN-02/03, TRUST-07, C10-C13)"
verdict: GHCR_CARRIES_REAL_CLEANUP_BURDEN
related: [001, 005]
tags: [ghcr, cleanup, security, credential]
---

# Spike 004: ghcr-hazards (GHCR-only operational burden)

## What This Validates

The GHCR-specific burdens the architecture ledger flags: mutable-tag overwrite (TRUST-07),
orphaned/untagged-manifest cleanup (C13), the cleanup-credential requirement (RETAIN-03/C11),
and the >5000-download undeletable wall (RETAIN-02/C10). These are the costs GHCR carries
that Releases does not.

## Research / Approach

Empirically: overwrote a tag with different content and inspected the resulting versions;
attempted a version deletion with the current `gh` token (`write:packages`, no
`delete:packages`). Documented facts (>5000 wall; fine-grained-PAT-unsupported) are already
established in `.planning/ARCHITECTURE-DECISION.md` C10/C11 and confirmed here, not
re-litigated. The in-repo `GITHUB_TOKEN` cleanup path (C11-preferred) needs a real Actions
token and is proven in the CI leg (005).

## How to Run

```bash
GH_TOKEN=$(gh auth token) node ghcr-hazards.mjs
```

## Results

**GHCR carries a real, multi-part cleanup burden that Releases does not.**

| Hazard | Empirical result | Ledger |
|--------|------------------|--------|
| Mutable-tag overwrite (no atomic create) | **Confirmed** - re-push repointed the tag to the new manifest | TRUST-07 (low-severity, C2/C6) |
| Orphaned untagged version | **Confirmed** - overwrite left the old manifest untagged (1 orphan) | C13 |
| Cleanup credential | **403: needs `delete:packages` + `read:packages`** - `write:packages` is insufficient | RETAIN-03 / C11 |
| Fine-grained PAT / App token for delete | Unsupported (documented) -> classic PAT for org/unlinked packages | C11 |
| >5000-download version | Undeletable (documented policy) - breaks age-cleanup + poison-remediation for popular PUBLIC entries | RETAIN-02 / C10 |

### Key findings

- **The cleanup-credential gap is real and empirically proven.** Pushing needs only
  `write:packages`, but **deleting needs `delete:packages` + `read:packages`** - a strictly
  larger credential. For a **user/org-unlinked** package that forces a **classic PAT**
  (fine-grained PATs and GitHub App tokens are unsupported for GHCR deletion). The escape
  (C11) is to keep the package **in-repo** so the repo's `GITHUB_TOKEN` with `packages: write`
  can delete it - validated in the CI leg (005).
- **Orphan accumulation is bounded for a content-addressed cache.** A trusted re-write of the
  same Nx hash is byte-identical (CORR-01) -> same layer+manifest digest -> **same version,
  no orphan**. Untagged orphans only appear from content-*changing* tag overwrites, which a
  correct cache never does. So C13 cleanup handles an edge case, not steady-state churn - but
  it must exist (reference-checked, fail-closed).
- **Multi-arch child manifests are N/A** for a single-blob cache (one manifest per tag);
  001/002/004 never produced children except the overwrite orphan.
- **The >5000-download wall is a genuine remediation gap** but scoped to popular PUBLIC
  entries; private-repo caches (the required case) and low-download entries are unaffected.

### Contrast with Releases (already built)

Releases cleanup uses a standard `contents:write` token (the same one that publishes), first-
party Octokit delete, no special scope, no PAT, no undeletable wall, no untagged-version
concept. The publish + age-cleanup subsystem already exists and is understood. GHCR would
require rebuilding an equivalent PLUS the delete-credential machinery, untagged-version
cleanup (C13), the visibility fail-closed assert (C18), and the >5000 exception (C10).

## Investigation Trail

1. Overwrote a tag with different content -> confirmed mutable overwrite + one orphaned
   untagged version.
2. Attempted deletion with the `gh` token -> 403 naming `delete:packages` + `read:packages`.
3. Cross-referenced the ledger's documented C10 (>5000) and C11 (fine-grained-PAT-unsupported);
   confirmed the empirical scope requirement matches.
4. Deferred the in-repo `GITHUB_TOKEN` deletion proof to the CI leg (real Actions token).

## Verdict

**GHCR_CARRIES_REAL_CLEANUP_BURDEN** - every paper hazard is confirmed. None is individually
disqualifying (all are ledger-covered), but together they are a materially larger operational
+ security control surface than Releases: delete-credential (>= `delete:packages`, classic PAT
for org/unlinked), untagged-version cleanup, visibility assert, and the >5000 remediation gap.
This is the strongest single dimension favoring Releases on forward merits.
