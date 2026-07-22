---
phase: 02
slug: default-cache-in-ci
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-19
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Governing threat: CREEP (CVE-2025-36852, cache poisoning). Register authored at plan time
> (all 6 PLAN.md files carry `<threat_model>` blocks) and verified against the implementation
> by `gsd-security-auditor` (State B, ASVS L1, block_on: high).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry -> workspace `node_modules` | Untrusted third-party code enters the build and CI runtime for the first time (`@actions/cache`, `@actions/core`). | Third-party package code (high) |
| `package.json` specifier -> resolved install | A range specifier would let an unreviewed future release enter without a human decision. | Version-resolution decision (high) |
| GitHub workflow context -> write authorisation | `GITHUB_EVENT_NAME` / `GITHUB_ACTIONS` decide whether the process may write to the shared cache. | Write-capability grant (critical) |
| fork-controlled trigger -> default-branch cache scope | Triggers that run with base-repo default-scope credentials while executing contributor-influenced context (CREEP precondition). | Cache-write scope (critical) |
| concurrent in-process writers -> one shared temp archive | Two same-hash writes target the identical temp path; without serialization one truncates the other mid-upload. | Cache artifact bytes (high) |
| archive path string -> toolkit version hash | The literal path is an input to key derivation, so the string is correctness-critical, not a formatting detail. | Cache key derivation (high) |
| this process -> GitHub cache service | Bytes leave the runner and become readable by every later job in the repository. | Cache artifact bytes (high) |
| runtime context -> write capability | The composition root decides once, at process start, whether this process can write. | Backend capability (critical) |
| runner teardown signal -> in-flight write | Between SIGTERM and kill, a partial write can be lost or block cleanup. | In-flight artifact + drain (high) |
| workflow log -> reader | Anything printed by the server or action is world-readable on a public repo. | Bearer + runtime tokens (high) |
| action runtime -> `serve` process | Runtime cache credentials must reach the server by inheritance and go no further. | `ACTIONS_RUNTIME_TOKEN` (high) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-2-SC | Tampering | npm install of `@actions/cache` / `@actions/core` | high | mitigate | Blocking human legitimacy checkpoint before install (`02-01-SUMMARY.md` Human Approval Gate; 6.2.0/3.0.1 approved); both pkgs confirmed lifecycle-install-script-free; durable pins `package.json:19-20` | closed |
| T-2-01 | Tampering | `package.json` dependency specifier | high | mitigate | Bare `x.y.z` pins `package.json:19-20`; `pinned-deps.spec.ts:20-32` asserts `/^\d+\.\d+\.\d+$/`, build-breaks on any range operator | closed |
| T-2-02 | Tampering | `package-lock.json` | medium | mitigate | npm-regenerated integrity hashes; `ci.yml` uses `npm ci` (lockfile-exact) in every job | closed |
| T-2-03 | Tampering / Elevation (CREEP) | `isWriteTrusted` allowlist | critical | mitigate | `trust.ts:10` `['push','schedule'] as const`; `:17-25` default-deny, no denylist path; `trust.spec.ts:84-86` deep-equality pin so a widening cannot land as a one-word edit | closed |
| T-2-04 | Spoofing | `GITHUB_EVENT_NAME` from env | medium | accept | Env is runner-spoofable; load-bearing control is GitHub server-side scope isolation + ephemeral single-tenant runner; in-code gate is defense-in-depth (see Accepted Risks) | closed (accepted) |
| T-2-05 | Tampering | allowlist duplication drift | medium | mitigate | Exactly one `TRUSTED_EVENTS` declaration (`git grep -c` == 1, only `trust.ts:10`) | closed |
| T-2-06 | Tampering (corruption) | concurrent same-hash writes to shared archive path | high | mitigate | `with-hash-lock.ts:16-35` chained `prior.then(run,run)` serializes per hash; wired at `serve.ts:85-96` (every `put` runs under `withHashLock`) | closed |
| T-2-07 | Denial of Service | wedged lock queue / unbounded map growth | medium | mitigate | `with-hash-lock.ts:19-20` no-wedge (run in both branches); `:28-32` identity-checked eviction `inFlight.get(hash) === tail` | closed |
| T-2-08 | Repudiation | swallowed operation failure | medium | mitigate | `with-hash-lock.ts:21-25` non-rejecting tail stored; `:35` returns real result so caller sees the true rejection (fail-closed write path) | closed |
| T-2-09 | Tampering (silent-MISS) | `cacheArchivePath` literal string | high | mitigate | Sole export (count == 1); both call sites resolve through it (`actions-cache-backend.ts:35,:55`); comment-lock `:4-17`; literal pin `cache-archive-path.spec.ts:18` | closed |
| T-2-10 | Repudiation / integrity | ambiguous `saveCache` sentinel + reserve-conflict | medium | mitigate | `actions-cache-backend.ts:69-77` only `-1` + `ReserveCacheError` -> `stored`, else `throw`; `server.ts:196-203` put fault -> 500 | closed |
| T-2-11 | Info disclosure / exhaustion | temp archive file left on disk | low | mitigate | `actions-cache-backend.ts:78-83` `finally rm` on put (success + error); `:46-51` same on get | closed |
| T-2-12 | Tampering (protocol drift) | hand-rolled protocol drift | medium | mitigate | `actions-cache-backend.ts:2,36,69` only `@actions/cache` `restoreCache`/`saveCache`; no direct endpoint call | closed |
| T-2-13 | Elevation of privilege | caller-facing mode surface on selection path | critical | mitigate | `select-backend.ts:36-38` single defaulted `env` param; `serve.ts:82` passes only `process.env`; `select-backend.spec.ts:189` `length===0` + `:192-214` override-shaped keys still yield `forbidden` | closed |
| T-2-14 | Spoofing / Tampering | malformed `GITHUB_REPOSITORY` in trusted context | high | mitigate | `select-backend.ts:7` `/^[^/]+\/[^/]+$/`; `:45-52` throws fail-closed on malformed identity | closed |
| T-2-15 | Denial of Service | unbounded SIGTERM drain | high | mitigate | `serve.ts:104-122` bounded `Promise.race([drained, bounded])`; `:114-116` `setTimeout(graceMs)` + `timer.unref()` — hung write yields to kill | closed |
| T-2-16 | Tampering (data loss) | writes lost at teardown | medium | mitigate | `serve.ts:81` in-flight `Set`, `:87` add, `:90-93` non-rejecting removal, `:113` shutdown awaits `allSettled` | closed |
| T-2-17 | Info disclosure | bearer token handling in composition root | medium | accept | Token fallthrough + CSPRNG minting unchanged from Phase 1, still spec-covered; log masking is 02-06's job (see Accepted Risks) | closed (accepted) |
| T-2-18 | Info disclosure | runtime cache creds re-exported through workflow env file | high | mitigate | `GITHUB_ENV` count == 0 in both `action/index.ts` and `ci.yml`; runtime token read from `process.env` (`index.ts:28`); `ci.yml:138-142` step-level `env` inheritance only | closed |
| T-2-19 | Info disclosure | bearer token printed to public log | high | mitigate | `action/index.ts:54` `core.setSecret(running.token)` is first statement after `serve()` (`:49`); serve's token-print path runs only under direct-invocation guard (`serve.ts:151-155`), never when imported by the action | closed |
| T-2-20 | Tampering | silently passing dogfood job | high | mitigate | `action/index.ts:74-80/:87-124/:126` every branch asserts exact status+body or `setFailed`; two-job split (`dogfood-seed`/`dogfood-verify`, `ci.yml` `needs:`) | closed |
| T-2-21 | Elevation of privilege | dogfood job writing on untrusted trigger | high | mitigate | `ci.yml:124,:147` `if: github.event_name == 'push'` (push scoped to `main`); `TRUSTED_EVENTS` unchanged; `selectBackend` independently returns RO on any non-push/schedule trigger (refused twice) | closed |
| T-2-22 | Denial of Service | job-level permission block silently dropping a scope | medium | mitigate | `permissions:` count == 1 (workflow-level only, `ci.yml:9`); no job-level block; hit read from local server response — no extra scope | closed |
| T-2-23 | Tampering | unreviewed cache dep upgrade changing archive version derivation | high | mitigate | `dogfood-verify` asserts HIT + matching bytes (`action/index.ts:87-124`) as the e2e gate; static pin guard (`pinned-deps.spec.ts`) prevents an unattended upgrade. Live post-merge HIT confirmed on CI run 29685631933 (see residual note) | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-2-01 | T-2-04 | `GITHUB_EVENT_NAME` is read from process env, which a compromised runner could set arbitrarily. The load-bearing control against a spoofed trigger is GitHub's server-side scope isolation plus the ephemeral single-tenant runner the deployment assumes; the in-code `isWriteTrusted` gate is defense-in-depth. Becomes decision-relevant only when Phase 5 widens to contributor-facing triggers. | Lars Gyrup Brink Nielsen | 2026-07-19 |
| AR-2-02 | T-2-17 | Bearer-token fallthrough + CSPRNG minting are unchanged Phase 1 behavior, still covered by existing specs; this phase introduces no new exposure. Masking of that token in CI logs is delivered by Plan 02-06 (T-2-19, closed). | Lars Gyrup Brink Nielsen | 2026-07-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-19 | 24 | 24 (22 mitigate verified + 2 accepted) | 0 | gsd-security-auditor (Opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-19

---

## Residual Notes (not open threats)

- **T-2-23 live confirmation:** the mitigation mechanism (seed -> verify canary + static pin guard) is fully present and verifiable in code/config. The real green cross-job cache HIT was confirmed on CI run **29685631933** (UAT / SC5), satisfying the post-merge human-check.
