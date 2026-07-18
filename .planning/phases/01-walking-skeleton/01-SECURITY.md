---
phase: 01
slug: walking-skeleton
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-18
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (four `<threat_model>` blocks across 01-01..01-04);
> this audit verifies each declared mitigation is present in the implemented code.
> block_on: high — a high+ severity OPEN threat blocks the phase.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Nx client -> server | The request line, `{hash}` path segment, `Authorization: Bearer` header, and request body cross here from an untrusted caller into the server process. | bearer token (secret), task-hash key, cache artifact bytes (up to 2 GiB) |
| server process -> loopback socket | The server exposes a listening socket; it must be reachable on loopback only, never a routable interface. | TCP listen bind address |
| server -> backend port | Only validated input reaches `backend.get`/`backend.put`; write context (RW vs RO) is fixed at construction, never caller-selectable. | validated hash, buffered body bytes, `PutResult` disposition |
| vendored spec file -> conformance test | The committed Nx OpenAPI contract is the source of truth the behavioral layer is checked against; drift in the file OR a `202`-class PUT-success regression must fail the build. | vendored contract bytes, PUT-success status code |
| npm registry -> workspace | Package installs / generator output crossing into the tree. Phase 1 is dependency-free, so this boundary carries no new install this phase. | (none this phase) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-1-01 | Spoofing / Elevation of Privilege | listen bind (SRV-01) | high | mitigate | `serve()` binds `127.0.0.1` only, never `0.0.0.0`, and exposes no host option — `serve.ts:57`. Real coverage: `serve.spec.ts:15,48`. | closed |
| T-1-02 | Information Disclosure | `makeAuthGate` token compare (SRV-02) | high | mitigate | Fixed-length SHA-256 digests compared via `crypto.timingSafeEqual`; no `===` / short-circuit — `server.ts:24-38`. | closed |
| T-1-02b | Information Disclosure | `timingSafeEqual` length oracle / throw (SRV-02) | medium | mitigate | Both expected + presented tokens hashed to 32-byte digests first, so lengths always match (no `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`, no length side-channel) — `server.ts:27,34`. | closed |
| T-1-07 | Spoofing | `generateToken` (SRV-02) | high | mitigate | Per-process token is `crypto.randomBytes(32).toString('hex')` (CSPRNG); never `Math.random`/timestamp — `server.ts:14-16`. | closed |
| T-1-03 | Tampering | `{hash}` path -> backend (SRV-03) | high | mitigate | `/^[a-f0-9]{1,512}$/` rejects malformed hash with `400` BEFORE any backend call (after auth) — `server.ts:8,79`; backend called at `:88`/`:137`. Spy tests prove not-called. | closed |
| T-1-04 | Denial of Service | request body buffering (SRV-04) | high | mitigate | `Content-Length` fast-reject `413` + streaming byte-counter with `req.destroy()` at `MAX_CACHE_BODY_BYTES` (2 GiB) — body never buffered unbounded — `server.ts:11,105-113,118-130`. | closed |
| T-1-05 | Denial of Service | `backend.get` fault escalated to 5xx (SRV-05) | medium | mitigate | Best-effort read: any `get` fault degrades to `404` MISS — `server.ts:87-100`; `put` fault fails closed as `500`, never a silent `200` — `server.ts:136-143`. | closed |
| T-1-06 | Elevation of Privilege | read-only context tricked into writing (D-04) | high | mitigate | RW/RO is a construction-time backend capability, not a request flag (TRUST-05); read-only `put` -> `'forbidden'` -> `403` — `memory-backend.ts:54-56`, `server.ts:156-165`. `never`-typed exhaustiveness default guards the `PutResult` map (D-06). `createCacheServer` has no `mode`/RW/RO caller param. | closed |
| T-1-09 | Tampering | vendored Nx spec drift / wrong PUT-success status (TEST-07) | high | mitigate | sha256 of the FULL committed spec vs `VENDORED_SPEC_SHA256` (`readFileSync`+`createHash`, never `info.version`) — `conformance.spec.ts:55-63`; behavioral layer asserts PUT success is exactly `.toBe(200)` — `conformance.spec.ts:80-93`. | closed |
| T-1-01b | Spoofing / DoS | `serve.ts` bind + port resolver + entry guard (SC4) | medium | mitigate | Binds `127.0.0.1` (`serve.ts:57`); `resolvePort` falls back to `0` on bad input, never `ERR_SOCKET_BAD_PORT` (`serve.ts:26-34`); Windows-safe guard `pathToFileURL(process.argv[1]).href` (`serve.ts:80-85`); token env read via `||` so a blank value mints a fresh CSPRNG token (`serve.ts:50-53`). | closed |
| T-1-02cfg | Tampering | hand-authored `project.json` | low | mitigate | Targets inferred by `@nx/js/typescript` + `@nx/vitest`; no drift-prone hand-maintained target config. Verified: `packages/github-cache/project.json` does not exist. | closed |
| T-1-SC | Tampering | `nx g @nx/js:lib` output / `package.json` (install) | high | accept | No package install occurs this phase — server uses `node:http`/`node:crypto`/`node:url`/`node:fs` stdlib only (D-01). Verified: lib `dependencies: {}` and `devDependencies: {}`; source imports are `node:*` + internal only. The install threat vector does not occur. See Accepted Risks Log RA-01. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| RA-01 | T-1-SC | Phase 1 installs zero packages (D-01 dependency-free JS-action mandate, FOUND-03). Verified: lib `dependencies`/`devDependencies` are empty and all source imports are stdlib `node:*` or internal — the supply-chain install vector does not occur this phase. Re-evaluate when Phase 2+ adds `@actions/cache`/`@octokit` (their own phase threat register). | gsd-security-auditor | 2026-07-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Audit Notes (informational — not threats; below block_on)

Non-blocking hardening observations surfaced by the code review (01-REVIEW.md). None is a declared threat and none blocks the phase; recorded so a future phase revisits them.

- **WR-01 (test quality, not a control gap):** the `server.spec.ts:29-36` "binds 127.0.0.1 only (SRV-01)" test is vacuous — it asserts the test harness's own `listen('127.0.0.1')` choice, not a production control (`createCacheServer` returns an unbound server by design). SRV-01's real mitigation (loopback bind) is genuinely present in `serve.ts:57` and authoritatively covered by `serve.spec.ts:15,48`, which assert `serve()` binds `127.0.0.1` and expose no host option. T-1-01 is CLOSED on the production code + `serve.spec.ts`, not on the vacuous test.
- **IN-02 (loopback-dev by design):** `serve.ts:74` `main()` prints the live bearer token to stdout. Acceptable for a loopback dev entrypoint, but lands a live secret in scrollback/CI logs if ever run in a shared context. Revisit for the Phase 6 distribution / background-step launch (gate on `isTTY` or write a `0600` token file). Below the high block threshold; not a Phase 1 threat.
- **IN-01/IN-03/IN-04/IN-05:** cosmetic / RFC-fidelity / test-hygiene notes (413 delivery race, case-sensitive `Bearer`, 404-vs-405, unconditional `afterEach`). Fail-closed and non-security-relevant; see 01-REVIEW.md.

**Unregistered flags:** none. No `## Threat Flags` section is present in any of 01-01..01-04 SUMMARY.md; no new attack surface appeared during implementation without a threat mapping.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-18 | 12 | 12 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-18
