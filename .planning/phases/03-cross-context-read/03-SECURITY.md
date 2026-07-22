---
phase: 03
slug: cross-context-read
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
threats_total: 19
asvs_level: 1
register_authored_at_plan_time: true
created: 2026-07-19
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 3 PLAN.md files carry `<threat_model>` blocks: 03-01, 03-02,
> 03-03) and verified retroactively against the implemented code by `gsd-security-auditor`
> (ASVS L1, block_on: high). This is NOT a blind vulnerability scan: every row below is checked
> against its own declared disposition, not against a generic checklist.

---

## Trust Boundaries

| Boundary | Description | Source Plan |
|----------|-------------|-------------|
| injected client -> backend `get` | An arbitrary `ReleaseReadClient` implementation (real or fake) may reject or return arbitrary bytes; the port must not let a rejection escape. | 03-01 |
| backend -> stderr | Warning text crosses into the developer's build log, which is frequently pasted into issues and CI transcripts. | 03-01 |
| task hash -> asset name | A `{hash}` value reaches a name that Plan 03 interpolates into a URL path. | 03-01 |
| process env -> credential chain | Environment values are attacker-influenceable in a compromised shell profile or a malicious `.env` loader. | 03-02 |
| Node -> spawned `gh` / `git` | Arguments cross into another process; a shell would make them a command line. | 03-02 |
| git remote URL -> repo identity | The remote URL is repository-controlled content that becomes a URL path segment in Plan 03. | 03-02 |
| credential helper -> resolved token | A secret crosses into this process's memory. | 03-02 |
| client -> api.github.com | The resolved token is attached to outbound HTTPS requests; a redirect could carry it to a third-party origin. | 03-03 |
| asset name + repo -> URL path | An attacker-influenced asset name or remote-derived repo becomes a URL path segment. | 03-03 |
| GitHub response -> Buffer | A hostile or oversized response body is read into memory. | 03-03 |
| selectBackend construction | The sync/async boundary: async credential work must not leak into the synchronous, zero-arity contract. | 03-03 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Evidence | Status |
|-----------|----------|-----------|----------|-------------|----------------------|--------|
| T-03-01 | Tampering | `createReleasesReadBackend.get` | high | mitigate | `releases-backend.ts:65-67` derives the name ONLY through `assetNaming.releaseAssetName(hash)`; `releases-backend.spec.ts:89-104` asserts the load-bearing NEGATIVE (a hash seeded only under the other platform MISSes, never a hit) with a `// Non-vacuous:` comment | closed |
| T-03-02 | Denial of Service | `createReleasesReadBackend.get` | medium | mitigate | `releases-backend.ts:63-86` one `try/catch` wraps the entire client call, catch returns `{ kind: 'miss' }`; `releases-backend.spec.ts:147-152` proves a rejecting client never escapes `get` | closed |
| T-03-03 | Information Disclosure | one-time stderr warning | high | mitigate | `releases-backend.ts:35-44` `warnOnce()` takes zero arguments and writes a fixed ASCII sentence; `get`'s catch uses `catch {` (optional catch binding, error unreachable); `releases-backend.spec.ts:182-194` asserts no credential-shaped text (`ghs_leakedtokenvalue`, `boom`) ever reaches stderr | closed |
| T-03-04 | Elevation of Privilege | `createReleasesReadBackend.put` | high | mitigate | `releases-backend.ts:92-94` `async put(): Promise<PutResult> { return 'forbidden'; }` — zero declared parameters, one return path; `releases-backend.spec.ts:124-143` asserts `'forbidden'` for a normal write, an empty buffer, and a hash already present in the client | closed |
| T-03-05 | Spoofing | `ReleaseReadClient` seam | medium | accept | Verified: `packages/github-cache/src/index.ts:1-10` (public barrel) exports only `createCacheServer` + port types — no `ReleaseReadClient`/`createReleasesReadBackend`/`createReleasesReadClient`. `git grep` confirms the ONLY production call site is `select-backend.ts:51`, always constructing the real client. See Accepted Risks Log AR-3-01 | closed (accepted) |
| T-03-06 | Denial of Service | warning volume | low | mitigate | `releases-backend.ts:26` module-level `let warned = false;`; `releases-backend.spec.ts:154-163` asserts zero stderr writes on the ordinary absent-asset path; `:169-180` asserts exactly one warning across two throwing `get` calls | closed |
| T-03-07 | Tampering / Elevation of Privilege | `runHelper` spawn | high | mitigate | `local-context.ts:53-73` `spawn(file, [...args], { shell: false, ... })`, explicit argv, no string interpolation. Source gate independently re-run: `shell: false` count 1, `shell: true` count 0 in non-comment lines | closed |
| T-03-08 | Information Disclosure | resolved token | high | mitigate | Independently grepped: zero `console.log`/`stdout.write`/`core.info`/`core.debug` referencing the token in `local-context.ts` or `releases-backend.ts`; the token flows only into return values and the `Authorization` header builders (`githubJsonHeaders`, download headers) | closed |
| T-03-09 | Information Disclosure | helper stderr | medium | mitigate | `local-context.ts:77-82` attaches a `stdout` data listener only; comment states no `stderr` listener is attached at all. `local-context.spec.ts:161-180` proves rich stderr + empty stdout still falls through to the next tier | closed |
| T-03-10 | Denial of Service | `git credential fill` | high | mitigate | `local-context.ts:53-73`: `timeout: HELPER_TIMEOUT_MS`, `GIT_TERMINAL_PROMPT: '0'`, `GIT_ASKPASS: ''`, `SSH_ASKPASS: ''`, all over a copy of `process.env`. `local-context.spec.ts:232-262` asserts all five properties on the recorded `git credential fill` spawn call | closed |
| T-03-11 | Spoofing | repo identity | high | mitigate | **Required the HI-01 review-fix to close** — see Residual Notes. Current code `local-context.ts:198-201`: `/^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?$/` is anchored at `^` to the literal host prefix. `local-context.spec.ts:382-401` asserts the exact two adversarial URLs from the code review (`evil.example.com/github.com/...`, `internal-proxy.corp/mirror/github.com/...`) resolve to `undefined` | closed |
| T-03-12 | Information Disclosure | anonymous downgrade | high | mitigate | `local-context.ts:118-158` `resolveLocalReadToken` has no anonymous branch; final `return undefined;` (line 157) after all 3 tiers. `local-context.spec.ts:217-230` asserts exactly 2 spawns (gh, then git) and no third attempt. `releases-backend.ts:184-192` `fetchAsset` returns `undefined` before any fetch when the token is unresolved | closed |
| T-03-13 | Repudiation | helper failure attribution | low | accept | Verified: `local-context.ts` `runHelper` resolves `undefined` identically for a non-zero exit and an `ENOENT` error event (structural-only, no stderr read) — matches the accept rationale exactly. See Accepted Risks Log AR-3-02 | closed (accepted) |
| T-03-14 | Information Disclosure | asset download redirect | high | mitigate | `releases-backend.ts:269-278` download `fetch` call sets only `headers` + `signal`, no `redirect` option. `rg -c "redirect"` on non-comment lines = 0 (2 comment-only mentions at lines 267-268 explaining WHY). `releases-backend.spec.ts:302-333` asserts `downloadInit.redirect` is `undefined` | closed |
| T-03-15 | Information Disclosure | anonymous downgrade | high | mitigate | `releases-backend.ts:184-192`: token resolved and checked for `undefined` BEFORE any fetch. `releases-backend.spec.ts:216-228` asserts the `fetch` spy recorded ZERO calls when no token resolves (non-vacuous: not merely the `undefined` return) | closed |
| T-03-16 | Denial of Service | REST fault handling | high | mitigate | **Required the HI-02 review-fix to close** — see Residual Notes. Current code: `releases-backend.ts:205-221,230-247,269-288` — every fetch carries `signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)`; 404 -> silent `undefined`, any other non-ok -> throw -> port degrades to warned MISS. `releases-backend.spec.ts:335-367` asserts all 3 fetches carry an `AbortSignal`; `:430-444` fault matrix (401/403/429/500 + rejected fetch) all degrade to MISS through the backend | closed |
| T-03-17 | Tampering | repo identity in URL path | medium | mitigate | `server.ts:8,89-94` `HASH_PATTERN = /^[a-f0-9]{1,512}$/` validated BEFORE dispatch to `handleGet`/`handlePut` (lines 96-100); repo segment comes only from `resolveRepoIdentity`, itself bounded by T-03-11's host-anchored regex | closed |
| T-03-18 | Information Disclosure | oversized asset body | low | accept | **Accept rationale partially inaccurate — corrected below, non-blocking (severity low, below block_on: high).** See Accepted Risks Log AR-3-03 for the correction | closed (accepted, corrected) |
| T-03-19 | Elevation of Privilege | `selectBackend` contract drift | high | mitigate | `select-backend.ts:40-42` one parameter with a default, non-`async`, returns `CacheBackend` synchronously. `select-backend.spec.ts:227-234` asserts `selectBackend.length === 0`; `:116-144` proves the real reader is wired end-to-end (a hit flows through) without breaking the sync contract | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**threats_open: 0** (no threat is open at any severity; block_on=high is therefore vacuously satisfied)

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|--------------|------|
| AR-3-01 | T-03-05 | The `ReleaseReadClient` seam is a constructor argument on `createReleasesReadBackend`/`createReleasesReadClient`, neither of which is exported from the package's public barrel (`src/index.ts`). Independently confirmed the ONLY production construction site is `select-backend.ts:51`, which always passes the real default client with no env value or caller argument able to swap it. Residual risk is in-package code review, not a runtime surface. | Lars Gyrup Brink Nielsen | 2026-07-19 |
| AR-3-02 | T-03-13 | A failed local-auth tier is structurally indistinguishable from an absent tool (`runHelper` resolves `undefined` identically for a non-zero exit and an `ENOENT` error event, confirmed in `local-context.ts`). Fine-grained attribution would require reading localized, potentially credential-adjacent stderr (verified Danish-language failure text on the research probe machine), which is the larger hazard. Every failure means the same thing to the caller by design. | Lars Gyrup Brink Nielsen | 2026-07-19 |
| AR-3-03 | T-03-18 | **Corrected rationale.** The plan's stated mitigation ("the existing 2 GB server body cap (SRV-04, Phase 1) bounds what the server will forward") does NOT hold as written: independently verified in `server.ts` that `MAX_CACHE_BODY_BYTES` (2 GiB) is enforced ONLY inside `handlePut` (lines 141-176, both the `Content-Length` fast path and the streaming accumulation loop) — `handleGet` (lines 110-129) calls `res.end(got.bytes)` with no size check at all. So a hostile or misconfigured Releases asset of unbounded size, if ever published, would be forwarded to the requesting Nx client with no local-side ceiling. Accepted anyway at LOW severity because: (a) Phase 3 is read-only and writes nothing to disk, so the exposure is memory-only per request, not persistent; (b) GitHub's own platform-enforced per-release-asset upload limit (2 GB as of this writing) is the real external bound today, external to this codebase; (c) the publisher that could create an oversized asset does not exist yet (Phase 4). Recommend Phase 4 either add an explicit read-side size guard in `handleGet`/`fetchAsset`, or correct this citation to name GitHub's platform limit rather than the local `SRV-04` cap, which does not apply to reads. | Lars Gyrup Brink Nielsen | 2026-07-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-19 | 19 | 19 (16 mitigate verified + 3 accepted, 1 accept-rationale corrected) | 0 | gsd-security-auditor (Opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (including one corrected rationale, AR-3-03)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-19

---

## Residual Notes (not open threats)

### Review-fix dependency: two threats were NOT fully closed until the code-review cycle landed

Retroactive audits must verify the CURRENT code, but it is worth recording that two threats in this
register were **not actually satisfied by the original plan-time implementation** and only reached
their claimed disposition after `03-REVIEW.md` found the gap and `03-REVIEW-FIX.md` closed it. Both
fixes were independently re-verified in the current source (not taken on the fix report's word):

- **T-03-11** (repo-identity spoofing, high, mitigate). The threat's own plan-time text claims "the
  remote URL must match an anchored GitHub owner/name regex." The originally-shipped regex
  (`/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/`) was end-anchored only, not host-anchored, and a
  URL merely *embedding* `github.com` as a path segment on a different host (e.g.
  `https://evil.example.com/github.com/attacker-org/attacker-repo`) misparsed into that segment's
  owner/repo instead of MISSing. Found as **HI-01**, fixed in commit `714ac3b` (confirmed present in
  `git log`), and the fixed regex plus both adversarial test URLs are confirmed live in
  `local-context.ts:198-201` and `local-context.spec.ts:382-401` today.
- **T-03-16** (REST fault handling / DoS, high, mitigate). The threat's own plan-time text claims
  "...so a rate-limited or offline GitHub can never break or stall the build." The originally-shipped
  `fetch` calls carried no `signal`/timeout at all, so a stalled TCP connection or slow-loris response
  would leave `await fetch(...)` pending for undici's multi-minute default — which **is** stalling the
  build, contradicting the threat's own claim. Found as **HI-02**, fixed in commit `443ea9d`
  (confirmed present in `git log`), and `AbortSignal.timeout(FETCH_TIMEOUT_MS)` is confirmed present
  on all three `fetch` calls in `releases-backend.ts` today, with a dedicated spec assertion
  (`releases-backend.spec.ts:335-367`).

Both gaps are now closed in the code that ships with this phase. This note exists so a future reader
does not assume the plan-time threat text alone was sufficient evidence — it was not, at the time it
was written; the implemented, reviewed-and-fixed code is.

### Other review findings cross-referenced against the threat register

- **ME-01** (medium, unmemoized token/repo resolution per `get()` call) does not map to a single
  declared threat ID, but amplifies the exposure window of T-03-10 (credential-helper DoS) and
  T-03-16 (network-hang DoS) by turning a once-per-build risk into a once-per-cache-lookup risk.
  Fixed in commit `667a97d` (confirmed present in `git log`); `createReleasesReadClient` now caches
  both resolver promises per client instance (`releases-backend.ts:180-181,187,196`), independently
  confirmed with `releases-backend.spec.ts:399-427` (resolvers run once per client; a second client
  re-resolves). Logged here as an informational, already-remediated gap rather than a new open
  threat, since no dedicated ID existed to reopen.
- **LO-01** (low, circular-import safety argument lived only in a planning artifact) is a
  maintainability note, not an attack surface. Fixed in commit `d236cf2` (confirmed present in
  `git log`); the constraint is now documented directly at the import site
  (`local-context.ts:2-11`).
- **LO-02** (low, bare `as` type assertions on GitHub JSON responses, deferred) is explicitly and
  correctly triaged as non-blocking: independently confirmed `createReleasesReadBackend.get`'s
  existing `try/catch` (T-03-02's mitigation) already degrades any resulting `TypeError` to a warned
  MISS, and a malformed `release.id` degrades cleanly through the existing 404 branch. No dedicated
  threat ID needed; already structurally covered.

### No `## Threat Flags` section found

Checked all three plan SUMMARY.md files (`03-01-SUMMARY.md`, `03-02-SUMMARY.md`,
`03-03-SUMMARY.md`) for a `## Threat Flags` heading per the audit's standard cross-reference step.
None exists in any of the three — there is no executor-flagged new attack surface to reconcile
against the register for this phase. The only new-surface findings available came through
`03-REVIEW.md` / `03-REVIEW-FIX.md` instead, and are cross-referenced above.

### Independent verification performed (not taken on documentation's word)

- Fresh (non-cached) `npx nx test github-cache --skip-nx-cache` run: **162/162 tests passing**,
  13 files, matching `03-REVIEW-FIX.md`'s claimed post-fix count.
- `git log` confirms all four fix commits (`714ac3b`, `443ea9d`, `667a97d`, `d236cf2`) exist in this
  branch's history with the expected subjects.
- `git diff --stat d5f3dee..HEAD -- package.json package-lock.json` is empty — zero dependency
  change holds across the entire phase.
- Source-gate greps independently re-run (not copied from acceptance criteria): `shell: false` count
  1 / `shell: true` count 0 in `local-context.ts`; `redirect` count 0 in non-comment lines of
  `releases-backend.ts`; zero `console.log`/`stdout.write`/`core.info`/`core.debug` touching a token
  in any phase-3 file; `createReleasesReadBackend`/`createReleasesReadClient` called from exactly one
  production site (`select-backend.ts:51`); `put()` and `createReleasesReadBackend()` signatures
  confirmed by direct read, not by trusting the acceptance-criteria table.
