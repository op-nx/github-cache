# Phase 6: Distribution + Docs + Governance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 6-Distribution + Docs + Governance
**Mode:** `--analyze --auto` decision mechanism (auto-lock recommended answers; escalate only HIGH-impact + NOT-high-confidence gray areas per the maintainer's trap-quadrant rule)
**Areas discussed:** Stability posture & distribution scope (escalated), Docs organization, Public-surface guard scope, CI sidecar pattern, Governance (SECURITY/LICENSE/semver)

---

## Stability posture & distribution scope (ESCALATED — user decided)

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-1.0, drift-guarded | Enumerate + guard-test the full consumer surface; GOV-03 = standard semver 0.x (surface may evolve pre-1.0, breaking bumps minor + documented, 1.0 freezes it); lean packaging; full scope kept | [x] |
| Stable from v0.0.1 | Freeze the enumerated surface as the stable contract immediately; any incompatible change is major from day one | |
| Minimal product surface | Distribute only the default CI-RW path; keep publish/sync/cleanup dogfood-internal; narrower than the ROADMAP | |

**User's choice:** Pre-1.0, drift-guarded (Recommended)
**Notes:** Why escalated — this is the one phase-6 decision that is both HIGH-impact (it is exactly what GOV-03's semver contract protects; adopters inherit it and it is hard to walk back) and NOT-high-confidence (the greenfield deliberately shed the PoC — "sunk cost = 0" — so the PoC's old surface is weak evidence, not a default). Auto-deciding it would violate the maintainer's `--auto` trap-quadrant rule.

---

## Docs organization (auto-locked)

| Option | Description | Selected |
|--------|-------------|----------|
| Root README quickstart + docs/ dir | Root README = 5-min default quickstart + landing; docs/ = advanced guide, config reference, trust/security, minimal example config | [x] |
| Everything in package README | Single package README with all sections | |

**User's choice:** auto (recommended) — standard OSS split; root README is currently a neutral shell.
**Notes:** Impact med / confidence high -> outside trap quadrant, auto-locked.

---

## Public-surface guard scope (auto-locked)

| Option | Description | Selected |
|--------|-------------|----------|
| Consumer contract only | Enumerate env knobs + action inputs + package exports; internal module helpers stay out; test fails on unintended change | [x] |
| Everything exported | Guard every module-level export | |

**User's choice:** auto (recommended) — consumer-contract-only.
**Notes:** Locked by the ROADMAP risk note + the dogfood-changes-stay-consumer-safe rule. Impact high / confidence high (scoping principle already decided) -> auto-locked.

---

## CI sidecar pattern (auto-locked)

| Option | Description | Selected |
|--------|-------------|----------|
| Background step + cancel + & fallback | serve as GA background step (background:true + cancel:), plain & fallback for GHES/old runners, JS-action rationale | [x] |
| services: container | Docker services block | (deferred — FOUND-03) |

**User's choice:** auto (recommended) — fully prescribed by DOCS-06 + STATE 02-06/04-06.
**Notes:** Impact high / confidence high -> auto-locked.

---

## Governance: SECURITY / LICENSE / semver (auto-locked)

| Option | Description | Selected |
|--------|-------------|----------|
| GH advisories + MIT + semver-vs-surface | GitHub private vuln reporting, MIT LICENSE (root + package), semver statement scoped to the enumerated surface | [x] |

**User's choice:** auto (recommended).
**Notes:** LICENSE=MIT is locked by GOV-02 (not a gray area). SECURITY.md contact email constrained to the public gmail, never the work domain (maintainer email-hygiene rule); prefer GH advisories so no email is needed. Impact low-med / confidence high -> auto-locked.

## Claude's Discretion

- Exact action-vs-bin packaging within the ACTIONS_RUNTIME_TOKEN constraint.
- Guard-test implementation (snapshot vs explicit list).
- docs/ file names, changelog format.
- Whether to wire an actual npm-publish release workflow now vs publish-ready only.

## Deferred Ideas

- Docker container distribution form (FOUND-03, later milestone).
- GHCR/OCI synced store (GHCR-01) + cosign attestation (PROV-01), later milestone.
- Live npm publish / release automation (may defer to a release step per D-13).
