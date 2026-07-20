---
phase: 05-trust-widening-ppe-gate
audited: 2026-07-20
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
threats_total: 12
threats_closed: 12
threats_open: 0
threats_open_blocking: 0
threats_accepted: 1
unregistered_flags: 0
status: secured
---

# Phase 5: Security Audit -- Trust-Widening + PPE Gate

**Audited:** 2026-07-20
**ASVS Level:** 1 (verify each declared mitigation is PRESENT in the cited file)
**block_on:** high (only OPEN threats of severity >= high count toward `threats_open_blocking`)
**Register source:** plan-authored -- all four PLANs (05-01..05-04) carry `<threat_model>` blocks. This audit VERIFIES each declared mitigation exists in the implementation; it does not scan for new vulnerabilities.

## Verdict

All 12 registered threats resolve CLOSED. Eleven are `mitigate` threats verified present in the cited implementation files; one (T-05-01-01) is a `accept`-disposition residual whose acceptance is documented in ADR C1 and recorded in the Accepted Risks log below. No mitigation was found absent. No unregistered attack surface appeared in the SUMMARY files (none declare a `## Threat Flags` section).

`threats_open_blocking: 0` -- the phase clears the security gate.

Authoritative signals reproduced during this audit:
- `npx nx test github-cache` -> 424/424 passing (21 test files), including the trust host matrix, the sync-gate cross-check, the 147-case `trust.generated.spec.ts` parity suite, the `cache-key.spec.ts` single-source count, the `publish-mirror.spec.ts` filter matrix, the backend exact-key assertion, and the `ppe-action.spec.ts` config-assertion.
- `node packages/github-cache/selfcheck.cjs` -> exit 0 ("in sync").
- `git ls-files` -> the unsafe fixture lives at `ppe/fixtures/unsafe-workflow.yml`, never under `.github/workflows`.

## Threat Verification

| Threat ID | Category | Severity | Disposition | Status | Evidence |
|-----------|----------|----------|-------------|--------|----------|
| T-05-01-01 | Spoofing | high | accept (residual) | CLOSED (accepted) | `trust.ts:35-46` structural `new URL().hostname` parse + fail-closed on throw; acceptance documented in ADR C1 and the Accepted Risks log below |
| T-05-01-02 | Elevation of Privilege | high | mitigate | CLOSED | `trust.ts:25` `HOST_GATED_EVENTS = ['pull_request','release']` (exactly two); `:62-70` default-deny, no denylist; dangerous trio (`pull_request_target`/`issue_comment`/`workflow_run`) absent from both arrays; `trust.spec.ts` refused-events matrix asserts refusal even WITH a github.com host present |
| T-05-01-03 | Tampering | high | mitigate | CLOSED | `trust.ts` imports nothing (verified: no `import`/`require` line), so it cannot import the sync gate; `sync-gate.ts:13` declares a SEPARATE `SYNC_EVENTS`; `trust.spec.ts:2,176,189` cross-check asserts `isSyncTrusted` still refuses `pull_request` AND `release` on a github.com default-branch run (ADR C2) |
| T-05-01-04 | Spoofing | medium | mitigate | CLOSED | `trust.ts:40,45` `URL(raw).hostname.toLowerCase()` then `host === 'github.com' \|\| host.endsWith('.ghe.com')` -- structural, never `includes`; `trust.spec.ts` host matrix rejects `github.com.attacker.com`, bare `ghe.com`, `notghe.com` |
| T-05-08-01 | Information Disclosure | high | mitigate | CLOSED | `cache-key.ts:34-39` `isServerProducedKey = startsWith(prefix) && HASH_PATTERN.test(suffix)`; `publish-mirror.ts:167-168` applies the filter to the enumerated entry set BEFORE the restore loop (`:178`), so a foreign or `nx-cache-<non-hex>` key is dropped before it can be mirrored (TRUST-08/C16, shipped first per D-09) |
| T-05-08-02 | Tampering | medium | mitigate | CLOSED | `cache-key.ts:18` the ONE authored `CACHE_KEY_PREFIX`; `cache-key.spec.ts:92` in-file `count===1` and `:132-133` strict cross-file `total===1` + `perFile['cache-key.ts']===1`; `git grep` confirms the only authored production literal is `cache-key.ts:18` |
| T-05-08-03 | Tampering | high | mitigate | CLOSED | `cache-key.ts:24-26` `cacheKeyFor(hash) = ` prefix+hash (byte-identical, no separator change); `actions-cache-backend.spec.ts:140-141` asserts restore/save keys equal `cacheKeyFor(HASH)` exactly |
| T-05-04-01 | Tampering | high | mitigate | CLOSED | Two-layer guard: `selfcheck.cjs` byte-diff (ran -> exit 0 "in sync") wired at `ci.yml:55-64` as a named job; `trust.generated.spec.ts:80` full-matrix `isWriteTrusted` parity + `:100` non-vacuous both-verdicts guard + `:104` deep-equal arrays |
| T-05-04-02 | Tampering | medium | mitigate | CLOSED | `selfcheck.cjs:89-145` `generateTrustCjs()` emits the `.cjs` from the single `trust.ts` source; GENERATED banner + do-not-hand-edit prohibition; parity spec + byte-diff fail on any manual divergence |
| T-05-04-03 | Config/Build | low | mitigate | CLOSED | `selfcheck.cjs:38,90` reads `src/lib/trust.ts` SOURCE (not dist), so it is build-order-independent; `:35-36` requires only `node:fs`/`node:path` (node builtins) |
| T-05-06-01 | Repudiation / False-assurance | high | mitigate | CLOSED | `ppe/action.yml:15-22` name + description mark it ADVISORY / best-effort defense-in-depth and "not the containment control"; `:52` zizmor `--no-exit-codes`; `:61` actionlint `\|\| true`; `ppe-action.spec.ts:50-57` mutation-proves the advisory switch + not-containment marker |
| T-05-06-SC | Tampering (supply chain) | high | mitigate | CLOSED | `ppe/action.yml:36` `pipx install zizmor==1.27.0` (exact pin); `:40-41` actionlint installer fetched from the `v1.7.12` TAG (not `main`) with the `1.7.12` version arg -- the WR-02 fix; self-installed at consumer runtime (no `package.json`/lockfile change); `ppe-action.spec.ts:42-48` mutation-proves both pins |
| T-05-06-02 | Elevation of Privilege | medium | mitigate | CLOSED | `git ls-files` confirms the fixture is `ppe/fixtures/unsafe-workflow.yml`, never under `.github/workflows`, so GitHub never schedules it; `ci.yml:77-83` uses it only as a `path:` scan target for the advisory `ppe` job |

## Open Threats (blocking -- severity >= high)

None.

## Open Threats (non-blocking -- severity below high)

None.

## Accepted Risks

### T-05-01-01 -- Spoofing of `GITHUB_SERVER_URL` (host-gate is fork-spoofable)

**Severity:** high | **Disposition:** accept (residual) | **Authority:** ADR C1 (`ARCHITECTURE-DECISION.md` Decision 2 / Decision 4 control C1)

The in-code host gate (`hostSupportsWidenedTrust`, `trust.ts:35-46`) infers GitHub's server-side read-only-default-branch cache guard from `GITHUB_SERVER_URL`. A fork/untrusted trigger can, in principle, inject a spoofed `GITHUB_SERVER_URL`, so this gate is explicitly NOT the load-bearing control. It is accepted as fork-spoofable **defense-in-depth only**:

- The load-bearing control is GitHub's server-side read-only-cache-token guard + Actions-cache VCS scope isolation (the actual CREEP defense, CVE-2025-36852). The host gate exists so trust is not falsely widened on GHES where that guard is absent -- a conservative fail-closed default.
- Blast radius is limited by the structural `URL().hostname` parse and fail-closed-on-throw/GHES behavior (verified present at `trust.ts:35-46`; T-05-01-04 covers the structural-match hardening).
- The optional `/meta` `installed_version` + `X-GitHub-Enterprise-Version` spoof cross-check is deliberately deferred (ADR D-04); it was NOT in Phase 5 scope and its absence is by design, not a gap.

This acceptance is a documented, deliberate residual, not an unmitigated hole. It does not count toward `threats_open`.

## Unregistered Flags

None. No Phase 5 SUMMARY declares a `## Threat Flags` section; each records a "Threat Surface" / "Threat Model Coverage" note that maps only to registered threat IDs. No new unmapped attack surface was introduced during implementation.

## Notes for Downstream

- **IN-01 (live-validation gap, informational):** the repo's own CI never live-exercises the newly-widened `pull_request`/`release` write path (dogfood/publish jobs gate on `push`). This is a validation-coverage observation from the code review, not a threat-mitigation gap -- the widening is exhaustively unit- and parity-tested. Tracked, non-blocking.
- **TRUST-06 live leg (human_needed):** the advisory `ppe` CI job's "actually emits findings" behavior closes on the first default-branch push (per 05-04-SUMMARY coverage D2). The structural mitigation (advisory posture, pins, fixture placement) is fully verified here; only the live findings observation is pending, and it is not a security gap.

---
*Audited by gsd-security-auditor. Register plan-authored (register_authored_at_plan_time: true); each declared mitigation verified present in implementation. Implementation files were not modified.*
