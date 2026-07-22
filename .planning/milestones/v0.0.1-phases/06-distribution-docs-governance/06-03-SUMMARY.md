---
phase: 06-distribution-docs-governance
plan: 03
subsystem: governance
tags: [license, mit, security-policy, vulnerability-disclosure, email-hygiene, allowlist-inversion, nx-inputs]

# Dependency graph
requires:
  - phase: 06-distribution-docs-governance
    plan: 01
    provides: package-level packages/github-cache/LICENSE + public-gmail author field (the root LICENSE mirrors this; the guard scans this package.json)
provides:
  - Root MIT LICENSE (holder "Lars Gyrup Brink Nielsen") at repo root (GOV-02/D-11)
  - Poisoning-class SECURITY.md (GitHub private vulnerability reporting primary, no email; 0.x supported-versions table; coordinated-disclosure window) (GOV-01/D-10)
  - CI-enforced public-repo email invariant via an allowlist-inversion guard (governance-email.spec.ts) with nx cache-input wiring so any scanned-file edit re-runs it
affects: [06-04, 06-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Allowlist-inversion guard: assert the ONLY email-shaped token in maintainer-authored files is the approved value; flag everything else; never encode the forbidden value"
    - "nx test-target inputs extended with out-of-project files a runtime-file-reading spec depends on, so the cache invalidates instead of replaying a stale pass (closes a false-assurance gap)"

key-files:
  created:
    - LICENSE
    - SECURITY.md
    - packages/github-cache/src/governance-email.spec.ts
  modified:
    - nx.json

key-decisions:
  - "SECURITY.md carries NO contact email: disclosure routes entirely through GitHub private vulnerability reporting (Security tab -> Report a vulnerability). Advisories-first is the cleanest satisfaction of the public-repo email rule -- there is no email token to leak (D-10)."
  - "Root LICENSE is byte-identical to the package-level LICENSE 06-01 shipped (same MIT text, 2026, holder Lars Gyrup Brink Nielsen). The root file is the repo license; the package copy is the tarball-bundled one -- both intentionally present, per D-11."
  - "The guard scans a fixed set of maintainer-authored files (SECURITY.md, LICENSE, root package.json, the package package.json) by allowlist inversion; the approved gmail is the ONLY allowed token. The forbidden work email/domain is never written in the spec -- encoding it as a search needle would itself be the leak (CLAUDE.md hard rule)."
  - "Guard is maintainer-content-scoped -- it checks authored files, NOT outside-contributor commit identities -- so it never blocks contributors' own emails."

patterns-established:
  - "Pattern: a runtime-file-reading vitest guard over repo-root files declares those files as nx test-target inputs; otherwise nx replays a cached pass and the guard silently stops enforcing."

requirements-completed: [GOV-01, GOV-02]

coverage:
  - id: G1
    description: "A root MIT LICENSE with copyright holder 'Lars Gyrup Brink Nielsen' exists at the repo root."
    requirement: GOV-02
    verification:
      - kind: other
        ref: "test -f LICENSE + rg 'MIT License' + rg 'Lars Gyrup Brink Nielsen' (both present)"
        status: pass
    human_judgment: false
  - id: G2
    description: "SECURITY.md names GitHub private vulnerability reporting / Security Advisories as the primary channel, has a pre-1.0 (0.x) supported-versions table, and a coordinated-disclosure window; contains no work email or bare work domain."
    requirement: GOV-01
    verification:
      - kind: other
        ref: "rg 'private vulnerability|security advisor' + 'supported versions' + 'coordinated disclosure' (all present); zero email-shaped tokens in the file"
        status: pass
    human_judgment: false
  - id: G3
    description: "The allowlist-inversion guard passes on the current tree (the only email token across all scanned files is the approved gmail in the package author field)."
    requirement: GOV-01
    verification:
      - kind: unit
        ref: "packages/github-cache/src/governance-email.spec.ts (4 tests, one per scanned file, all pass under npx nx test github-cache)"
        status: pass
    human_judgment: false
  - id: G4
    description: "The guard fails the build if a non-gmail email is introduced into any scanned file, and the nx cache re-runs it on such a change (no stale replay)."
    requirement: GOV-01
    verification:
      - kind: unit
        ref: "mutation proof: injected evil@example.com into SECURITY.md -> RED with --skip-nx-cache (logic) AND RED without it (cache invalidation, exit 1); restored -> GREEN"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-21
status: complete
---

# Phase 6 Plan 03: Governance (LICENSE + SECURITY.md + email guard) Summary

**Shipped the two governance files a poisoning-class tool requires -- a root MIT LICENSE (GOV-02) and an advisories-first SECURITY.md (GOV-01) -- plus an allowlist-inversion email-hygiene guard that makes the public-gmail-only rule a CI-enforced invariant, with nx cache inputs wired so the guard actually re-runs when any scanned file changes.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 2
- **Files created:** 3 (LICENSE, SECURITY.md, governance-email.spec.ts)
- **Files modified:** 1 (nx.json)

## Accomplishments

- Authored the root MIT LICENSE (holder "Lars Gyrup Brink Nielsen", 2026), byte-identical to the package-level copy 06-01 bundled into the tarball (GOV-02/D-11).
- Authored SECURITY.md for a poisoning-class (CREEP, CVE-2025-36852) tool: GitHub private vulnerability reporting as the PRIMARY channel (so no contact email is needed at all), a pre-1.0 (0.x) supported-versions table, and a coordinated-disclosure window (7-day triage target, advisory-coordinated disclosure after a fix, 90-day backstop, reporter credit) (GOV-01/D-10).
- Authored the allowlist-inversion email guard (governance-email.spec.ts): scans SECURITY.md, LICENSE, the root package.json, and the package package.json; asserts the only email-shaped token present is the approved public gmail; a file with zero tokens passes. Maintainer-content-scoped; never encodes the forbidden value.
- Closed a false-assurance gap in the guard's own wiring: the scanned root files were outside the github-cache test target's nx input graph, so an nx cache hit replayed a stale pass on a SECURITY.md edit. Added the three repo-root files as `test` target inputs so any change invalidates the cache and re-runs the guard. Mutation-proven both ways.

## Task Commits

Each task was committed atomically:

1. **Task 1: root MIT LICENSE + poisoning-class SECURITY.md** -- `2957f19` (feat)
2. **Task 2: allowlist-inversion email guard + nx cache-input wiring** -- `28a777d` (test)

**Plan metadata:** final docs commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Files Created/Modified

- `LICENSE` -- Root MIT license, holder "Lars Gyrup Brink Nielsen", 2026. Repo-root license (the package-level tarball copy is a separate file created by 06-01). No extension, so prettier skips it; git normalizes to LF (eol=lf).
- `SECURITY.md` -- Poisoning-class vulnerability-disclosure policy. GitHub private vulnerability reporting primary (no email), 0.x supported-versions table, coordinated-disclosure window. Prettier-normalized (table alignment, LF); ASCII only; zero email-shaped tokens.
- `packages/github-cache/src/governance-email.spec.ts` -- Allowlist-inversion guard (node:fs + a regex, dependency-free), modeled on pinned-deps.spec.ts (readFileSync via new URL(..., import.meta.url)). One `it` per scanned file. Header documents maintainer-content scope and the never-encode-the-forbidden-value discipline.
- `nx.json` -- Added `{workspaceRoot}/SECURITY.md`, `/LICENSE`, `/package.json` to the `test` target inputs so a change to any scanned file busts the cache and re-runs the guard.

## Decisions Made

- **Advisories-first, no email in SECURITY.md.** D-10 prefers GitHub private vulnerability reporting so no email is needed; taking that literally means SECURITY.md carries zero email-shaped tokens, which is the strongest possible satisfaction of the public-repo email rule (nothing to leak). The guard allows an email-free file to pass for exactly this reason.
- **Root LICENSE is intentionally identical to the package LICENSE.** Both exist by design (D-11: MIT at repo root AND bundled into the package); the guard scans the root one, npm ships the package one.
- **Guard is a vitest spec (plan-faithful) but needs nx input wiring to enforce.** A spec that reads out-of-project files is silently cache-masked by nx; declaring those files as `test` inputs is the nx-native fix that keeps the guard a spec while making it a real CI gate. Chosen over creating a project.json (D-02 forbids one for github-cache) or moving the guard to a standalone CI job (plan specifies a spec).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] nx cache replayed a stale pass, defeating the guard**
- **Found during:** Task 2 (mutation proof of the guard)
- **Issue:** The guard reads SECURITY.md, LICENSE, and the root package.json at test runtime, but those files are outside the github-cache `test` target's nx input graph (`{projectRoot}/**/*` + `sharedGlobals` only). Injecting a non-gmail email into SECURITY.md and re-running `npx nx test github-cache` produced a CACHE HIT ("existing outputs match the cache, left as is") -- a stale GREEN. The guard therefore did NOT enforce on a change to 3 of its 4 scanned files, which is precisely the plan's own T-06-03-02 false-assurance threat and fails the acceptance criterion "if a non-gmail email is introduced into any scanned file the test fails".
- **Fix:** Added `{workspaceRoot}/SECURITY.md`, `{workspaceRoot}/LICENSE`, and `{workspaceRoot}/package.json` to `targetDefaults.test.inputs` in nx.json (the package's own package.json is already covered by `{projectRoot}/**/*`).
- **Files modified:** nx.json
- **Verification:** After the fix, injecting evil@example.com into SECURITY.md and running `npx nx test github-cache` WITHOUT `--skip-nx-cache` re-ran the test and went RED (exit 1, no stale replay); restoring the file returned GREEN. Logic was separately proven with `--skip-nx-cache` before the fix.
- **Committed in:** 28a777d (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 2). It was necessary for the guard to satisfy its own acceptance criteria and mitigate T-06-03-02; it stays within the plan's intent (a guard that fails the build on a bad email). The one file added beyond `files_modified` (nx.json) is the minimal, nx-native wiring that makes the specified spec enforce.

## Threat Surface

Both threats in the plan's register are mitigated:
- **T-06-03-01 (Information Disclosure, high):** LICENSE and SECURITY.md contain zero email-shaped tokens (advisories-first); the allowlist-inversion guard fails the build on any non-gmail email token across the scanned files, mutation-proven. Public-gmail-only is now a CI invariant.
- **T-06-03-02 (Repudiation / False assurance, medium):** SECURITY.md routes reports through GitHub private vulnerability reporting with a stated coordinated-disclosure window, so a poisoning report is handled privately, not as a public issue. Additionally, the guard's own false-assurance gap (stale nx cache) was closed so the mitigation cannot silently stop enforcing.

No new threat flags: these are static governance files plus a read-only, dependency-free test; no new network endpoints, auth paths, file-write surface, or schema changes.

## Known Stubs

None. LICENSE is the complete MIT text, SECURITY.md is complete prose + table, and the guard is fully wired (no placeholders, empty data, or TODO/FIXME markers).

## User Setup Required

None. Disclosure routing uses GitHub's built-in private vulnerability reporting (enable it under the repo's Security settings if not already on -- no code or external service required).

## Self-Check: PASSED

All 3 created artifacts exist on disk (LICENSE, SECURITY.md, packages/github-cache/src/governance-email.spec.ts) and both task commits (2957f19, 28a777d) are present. Full github-cache suite green: 433 tests / 23 files (+4 tests, +1 file from the guard). format:check clean on all touched files (SECURITY.md, nx.json, the spec).

---
*Phase: 06-distribution-docs-governance*
*Completed: 2026-07-21*
