---
phase: 06
slug: distribution-docs-governance
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-21
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 5 plans carry a `<threat_model>` block); this
> audit VERIFIES each declared mitigation exists in the implemented code. block_on: high.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repo -> published npm tarball | Files leave the repo into a public tarball adopters install; anything not excluded by `files` leaks | Package contents (dist/, LICENSE, README, package.json); risk = dogfood/CI/secret leakage |
| repo git ref -> consumer `uses:` action | External repos resolve `start-cache-server/index.js` from the ref; a stale/tampered bundle runs in their CI | Committed esbuild bundle (executable JS) |
| workspace build tooling -> committed bundle | The esbuild devDependency + its output become a supply-chain input to every consumer | Build-tool version + bundle bytes |
| dogfood change -> consumer contract | An internal refactor could silently add/rename/remove a consumer-facing export, action input, or env knob | Public API surface (exports, action inputs, env knobs) |
| maintainer identity -> public repo | Authored governance/package files could leak the maintainer's private/work email or bare domain into a public repo | Contact identity (email/domain) |
| vulnerability reporter -> maintainer | The disclosure channel must be private and coordinated, not a public issue that discloses a live poisoning vector | Vulnerability report |
| docs -> adopter action / mental model | Adopters copy the documented pattern verbatim and make trust decisions from the docs; a wrong instruction or claim becomes their CI config / posture | CI config guidance + trust model claims |
| single-source model -> rendered prose | Hand-typed prose can drift from `trust.ts` / `sync-gate.ts`, asserting a model the code does not implement | Rendered trust/security doc |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01-01 | Information Disclosure | npm tarball (files list) | high | mitigate | `files:["dist"]` allow-list (`packages/github-cache/package.json:26-28`) + `pack-check.cjs` REQUIRED/FORBIDDEN predicates (asserts dist/LICENSE/README/package.json present; src/, action.yml, selfcheck.cjs, pack-check.cjs, tsconfig*, vitest config, .env, .github/, .planning/, nx.json, start-cache-server/ excluded) + CI `pack-check` job (`.github/workflows/ci.yml:89-99`) | closed |
| T-06-01-02 | Tampering (supply chain) | esbuild devDependency | high | mitigate | esbuild exact-pinned `0.28.1` in ROOT `devDependencies` (`package.json:33`) + `pinned-deps.spec.ts:58-70` fails the build on a range; devDependency only, excluded from the `files:["dist"]` tarball (never shipped) | closed |
| T-06-01-03 | Tampering | committed `start-cache-server/index.js` | high | mitigate | `check:action` script `build:action && git diff --exit-code -- start-cache-server/index.js` (`package.json:17`) + CI `action-bundle-drift` job (`ci.yml:73-82`) — a hand-edited or stale bundle fails CI | closed |
| T-06-01-04 | Information Disclosure | package.json author / LICENSE holder | high | mitigate | author = approved public gmail ONLY (`packages/github-cache/package.json:5`); independent scan confirms the sole email-shaped token across all maintainer/doc files is `larsbrinknielsen@gmail.com`; both LICENSE files MIT / holder "Lars Gyrup Brink Nielsen"; backstopped repo-wide by the T-06-03-01 allowlist-inversion guard | closed |
| T-06-01-05 | Elevation of Privilege | background-step smoke job permissions | low | accept | `consumer-smoke` is push-gated (`ci.yml:264` `if: github.event_name == 'push'`); no job-level `permissions:` block, so it inherits the workflow-default `contents: read` (`ci.yml:9-10`); loopback `127.0.0.1:3000`, per-run token; no fork-PR token, no write scope requested (accepted risk, below block threshold) | closed (accepted) |
| T-06-02-01 | Tampering | consumer public surface (exports/inputs/knobs) | medium | mitigate | `public-surface.spec.ts` explicit-assertion-list guard: exact-equality on barrel value exports (`['createCacheServer']`), parsed type exports, action inputs (`['port']`), the 7 env knobs, and the fixed `MAX_CACHE_BODY_BYTES` — any unenumerated change fails `nx test github-cache` | closed |
| T-06-02-02 | Tampering | documented env knob vs code | medium | mitigate | `public-surface.spec.ts:180-191` per-knob word-boundary presence cross-check across a fixed source-file set (`server.ts`, `serve.ts`, `retention.ts`, `github-identity.ts`, `select-backend.ts`, `start-cache-server/entry.ts`) — a rename that orphans a documented knob fails the guard | closed |
| T-06-03-01 | Information Disclosure | SECURITY.md / LICENSE / package.json contact fields | high | mitigate | `governance-email.spec.ts` allowlist-inversion guard (only `larsbrinknielsen@gmail.com` permitted; never encodes the forbidden value; maintainer-content-scoped) over SECURITY.md/LICENSE/root package.json/package package.json; nx test-input wiring so an edit busts the cache; independent grep confirms zero non-approved tokens | closed |
| T-06-03-02 | Repudiation / False assurance | disclosure policy | medium | mitigate | `SECURITY.md` routes reports through GitHub private vulnerability reporting (Security tab -> Report a vulnerability), with a Coordinated Disclosure section (7-day triage target, advisory-coordinated disclosure after fix, 90-day backstop) — a poisoning report stays private, not a public issue | closed |
| T-06-04-01 | Elevation of Privilege | `&` fallback documentation | high | mitigate | `docs/advanced.md` scopes the `&` fallback to the read-only Releases reader path ONLY and states plainly CI-RW requires the JS action (a plain `run:`/`&` step lacks `ACTIONS_RUNTIME_TOKEN`, so `save`/`restore` silently no-op); no instruction to background CI-RW writes on a plain step | closed |
| T-06-04-02 | Repudiation / False assurance | `MAX_CACHE_BODY_BYTES` doc | medium | mitigate | `docs/configuration.md` "The body-size limit is fixed" section documents it as a fixed 2 GiB contract limit, NOT read from the environment, no knob to change it — adopters do not expect a non-existent env override | closed |
| T-06-04-03 | Information Disclosure | consumer-surface confusion | medium | mitigate | Docs never present the internal `packages/github-cache/action.yml` dogfood action as the consumer surface (README states it "is not for consumer use"; advanced.md documents publish/sync/cleanup by capability); `docs-adoption.spec.ts` asserts the minimal example excludes dogfood-only tokens (`operation:`/`matrix:`) | closed |
| T-06-05-01 | Elevation of Privilege | trust doc guidance | high | mitigate | `docs/trust-and-security.md` §3 states github.com-only + "do not enable pull-request/release writes on GHES below the floor" with NO guessed version; §4 "Never enable fork-pull-request write tokens or secrets" | closed |
| T-06-05-02 | Repudiation / False assurance | CREEP / retention framing | high | mitigate | `docs/trust-and-security.md` §1 frames the in-code host gate as fork-spoofable DEFENSE-IN-DEPTH (not the control); §5 containment = sync gate + default-branch protection + ephemeral runners; §7 retention = storage hygiene, NOT poison-containment | closed |
| T-06-05-03 | Tampering (doc drift) | rendered trust model | medium | mitigate | `docs-trust.spec.ts` single-source drift guard imports the REAL `TRUSTED_EVENTS`/`HOST_GATED_EVENTS` (`trust.ts`) + `SYNC_EVENTS` (`sync-gate.ts`) and asserts every event string renders verbatim in the trust doc — a future allowlist change trips the build until the doc catches up | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-01-05 | The `consumer-smoke` CI job runs the sidecar as a background step. Verified push-gated (`if: github.event_name == 'push'` — never on fork pull_request), no job-level `permissions:` block (inherits the workflow-default `contents: read`), binds loopback `127.0.0.1:3000` only, uses a per-run token, and requests no write scope or fork-PR token. Residual privilege is the workflow-default read grant plus the JS-action-only runtime cache credentials, which are independent of the workflow token grant. Severity low, below the `high` block threshold. | Phase 06 plan author (register authored at plan time); confirmed present by this audit | 2026-07-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-21 | 15 | 15 | 0 | gsd-security-auditor (Claude) |

Notes:
- 14 threats `mitigate` (all verified present in code/docs/tests), 1 threat `accept` (T-06-01-05, documented in Accepted Risks Log).
- Severity distribution: 8 high, 6 medium, 1 low. All closed; `threats_open` (OPEN at/above `high`) = 0.
- Threat Flags: all 5 SUMMARY files declare "No new threat flags" / "No new surface" — no unregistered attack surface. Zero unregistered flags.
- ASVS L1 verification: each declared mitigation confirmed PRESENT in the file cited by its mitigation plan (grep/read-level), plus an independent allowlist-inversion email scan across all maintainer/doc files.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-21
