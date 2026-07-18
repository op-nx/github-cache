---
phase: 0
slug: teardown
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
# block_on: high -> only OPEN threats of severity high or critical count. All 11 threats are CLOSED.
threats_open: 0
asvs_level: 1
created: 2026-07-18
---

# Phase 0 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase 0 is a teardown/prep phase (removed the `@op-nx/github-cache` spike + its
> cache-coupled CI). It delivers no runtime feature; the threat surface is a net
> REDUCTION. The security concern is only that the teardown did not weaken the
> posture later phases (Phase 3 cross-OS, Phase 5 CREEP controls) stand on.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| GitHub trigger -> workflow token scope | CI workflow `permissions:` decide what a run (including one from an untrusted PR trigger) can write. Reducing scope hardens the boundary Phase 3/5 CREEP controls stand on. | GITHUB_TOKEN scope (runner-injected) |
| Deleted-control surface (teardown) | Removal-only. The only security-relevant risk is losing a DORMANT control (cross-OS hash invariants) while deleting; no new input, auth, or crypto surface is added. | Config/source deltas only |
| Regenerated codebase map -> Phase 1 priming | `.planning/codebase/*` is read by the Phase 1 planner; stale PoC prose or a leaked secret would prime the rebuild. | Documentation content |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-00-01 | Tampering | nx.json `integration` targetDefault + discriminator; `.gitattributes eol=lf` | medium | mitigate | Both preserved. `node -p process.platform` present at `nx.json:73`; `* text=auto eol=lf` present at `.gitattributes:7`. | closed |
| T-00-02 | Tampering (supply chain) | `npm install` lockfile resync | low | accept | Prune-only resync; no new direct dependency (`package.json` devDeps carry no `@actions/cache` / `@octokit` / direct `verdaccio`). Residual `verdaccio` in lockfile is a transitive `optional:true` peer of `@nx/js`, not a PoC ref. | closed |
| T-00-03 | Information disclosure | removed package + resynced lockfile | low | accept | No repo secret/credential committed. Scan for `ACTIONS_RUNTIME_TOKEN` / `GITHUB_TOKEN` / `GH_TOKEN` and PAT-shaped tokens over tracked files (excl `.planning` history) returns zero matches. | closed |
| T-00-04 | Elevation of Privilege | `ci.yml` workflow/job `permissions:` | high | mitigate | Workflow-level `permissions: contents: read` only (`ci.yml:9-10`). No `contents: write`, no `actions:` scope, no job-level `permissions:` block anywhere (greps return exit 1). | closed |
| T-00-05 | Tampering | `ci.yml` triggers / branch-protection surface | medium | mitigate | `push: branches: [main]` + `pull_request` triggers preserved unchanged (`ci.yml:3-7`); rework removed only cache wiring, not the trigger contract branch protection keys on. | closed |
| T-00-06 | Information disclosure | reworked `ci.yml` | low | accept | No secret/token literal introduced; removed jobs used only runner-injected tokens. No third-party action beyond `actions/checkout` + `actions/setup-node`. | closed |
| T-00-07 | Information disclosure | `README.md` content | low | accept | Neutral placeholder only. No PoC prose, no `op-nx-github-cache`, no `the only package` claim, no email address / work domain (email-shaped token scan over tracked source/config returns zero matches). | closed |
| T-00-08 | Tampering | `.prettierignore` scope creep | low | accept | Only doc/artifact trees added (`.planning/`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.gsd-migration-backup/`). No consumer-contract / workspace-source path is ignored (dogfood-safe). | closed |
| T-00-09 | Tampering | dormant Phase-3 invariants surviving teardown (merged-tree cross-check) | medium | mitigate | Merged-tree re-assertion of T-00-01: `node -p process.platform` (nx.json) and `eol=lf` (.gitattributes) both still present after all Wave-1 merges. | closed |
| T-00-10 | Elevation of Privilege | `ci.yml` permission posture (merged-tree cross-check) | low | accept | Merged-tree re-grep confirms no `contents: write` / `actions:` scope re-appeared in `ci.yml`; cross-check of T-00-04 mitigation holds. | closed |
| T-00-11 | Information disclosure / priming | regenerated `.planning/codebase/*` | low | accept | SC5 no-trace grep over `.planning/codebase/**` (`op-nx-github-cache|start-cache-server|publish-mirror|selectBackend|CacheBackend|@actions/cache|@octokit`) returns zero matches; all 7 map docs present. | closed |

*Status: open . closed . open - below high threshold (non-blocking)*
*Severity: critical > high > medium > low - only open threats at or above `block_on: high` count toward threats_open*
*Disposition: mitigate (implementation required) . accept (documented risk) . transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-00-01 | T-00-02 | Lockfile resync is prune-only (removed `@actions/cache`, `@octokit/*`, direct `verdaccio`, PoC workspace entry); adds zero new packages. Residual `verdaccio` is a transitive `optional:true` peer of `@nx/js` (workspace-core), verified via `npm ls verdaccio`; forcing it out would need `--omit=optional` and desync the default `npm ci` gate. No `[ASSUMED]`/`[SUS]` package to vet. | gsd-security-auditor | 2026-07-18 |
| AR-00-02 | T-00-03 | The PoC stored no repo secret; the 3 GitHub credentials the project uses (per-process CSPRNG bearer, ACTIONS_RUNTIME_TOKEN, GITHUB_TOKEN/GH_TOKEN) are runtime-only and confirmed absent from committed files. | gsd-security-auditor | 2026-07-18 |
| AR-00-03 | T-00-06 | Reworked `ci.yml` introduces no secret/token literal; removed jobs used only runner-injected tokens. Confirmed by grep for scope escalation and token literals. | gsd-security-auditor | 2026-07-18 |
| AR-00-04 | T-00-07 | `README.md` is a neutral shell placeholder; no PoC references, dead links, email, or work domain (public-repo hygiene). Confirmed by grep. | gsd-security-auditor | 2026-07-18 |
| AR-00-05 | T-00-08 | `.prettierignore` additions are churny doc/artifact trees only; no consumer-contract file is ignored, so the format gate stays on real source. | gsd-security-auditor | 2026-07-18 |
| AR-00-06 | T-00-10 | Merged-tree cross-check of the T-00-04 least-privilege posture; no scope re-grant found. | gsd-security-auditor | 2026-07-18 |
| AR-00-07 | T-00-11 | Regenerated codebase map carries no PoC trace / rebuild-priming artifact into the docs Phase 1 reads; SC5 grep clean. | gsd-security-auditor | 2026-07-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-18 | 11 | 11 | 0 | gsd-security-auditor |

**Verification method (ASVS L1, block_on: high):** each `mitigate` threat verified by
grep for the declared pattern in the cited live file; each `accept` threat logged in the
Accepted Risks Log above and its underlying claim spot-checked against the tree. No
`## Threat Flags` sections were present in any Phase 0 SUMMARY, so there are no
unregistered flags.

Evidence anchors (live tree, not SUMMARY prose):
- T-00-04: `.github/workflows/ci.yml:9-10` (`permissions: contents: read`); no `contents: write` / `actions:` / job-level `permissions:` (grep exit 1).
- T-00-01 / T-00-09: `nx.json:73` (`node -p process.platform`), `.gitattributes:7` (`eol=lf`).
- T-00-05: `.github/workflows/ci.yml:3-7` (`push: branches: [main]` + `pull_request`).
- T-00-03 / T-00-06 / T-00-07: credential + email-shaped token scans over tracked files return zero matches.
- T-00-11: `git grep` over `.planning/codebase/**` for PoC tokens returns zero matches; all 7 map docs tracked.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-18
