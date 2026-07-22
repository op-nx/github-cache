---
phase: 05-trust-widening-ppe-gate
verified: 2026-07-20T18:39:56Z
status: passed
live_proof_confirmed: "CI run 29772015309 on main (fe08c7c) GREEN: the advisory ppe job self-installs zizmor==1.27.0 + actionlint 1.7.12 and scans the fixture (findings as annotations, job non-failing) + selfcheck job + both publish/publish-verify cross-OS legs all success. The live PPE findings-produced proof is confirmed. (First live run 29771418344 failed on a missing mkdir for the actionlint install dir — caught ONLY by the live leg, not the local config-assertion spec — fixed in fe08c7c.)"
score: 21/22 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Confirm the advisory `ppe` CI job (ci.yml) actually runs on a real GitHub-hosted runner, self-installs zizmor==1.27.0 + actionlint 1.7.12, scans ppe/fixtures/unsafe-workflow.yml, and emits dangerous-triggers/template-injection findings while the job itself PASSES (advisory, --no-exit-codes / swallowed exit)."
    expected: "zizmor and/or actionlint annotations appear on the `ppe` job run for the fixture's pull_request_target + PR-head-checkout + untrusted-expression-in-run pattern; the job is green (non-blocking)."
    why_human: "Requires a live GitHub Actions runner to self-install external tools (pipx zizmor, download-actionlint.bash) and execute them against the fixture -- not reproducible in local Vitest. This is the same first-push closing pattern as Phase 4's cross-OS mirror round-trip; TRUST-06's structure/pins/advisory-posture are already mutation-proven locally (ppe-action.spec.ts, 6 tests green)."
---

# Phase 5: Trust-Widening + PPE Gate Verification Report

**Phase Goal:** Widen write-trust to `pull_request`/`release` only where GitHub's untrusted-default-branch cache guard exists (host-detected, fail-closed on GHES), from a single-source allowlist; ship the server-produced-key mirror filter that private-repo mirroring requires; ship an adopter-facing PPE-hygiene gate as a composite action.
**Verified:** 2026-07-20T18:39:56Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TRUST-08: `isServerProducedKey` admits `nx-cache-`+valid lowercase-hex, rejects foreign key AND `nx-cache-<non-hex>` (never "any 1-512 hex") | VERIFIED | `src/lib/cache-key.ts:34-39`; `cache-key.spec.ts` admit/reject describe block (7 assertions), all green |
| 2 | TRUST-08: `cacheKeyFor(hash)` round-trips through `isServerProducedKey` for any hex `h` | VERIFIED | `cache-key.ts:24-26`; `cache-key.spec.ts:63-73` (round-trip incl. `f`.repeat(512)) |
| 3 | TRUST-08: `publishMirror` mirrors only server-produced keys; `nx-cache-<non-hex>`/foreign keys filtered BEFORE restore | VERIFIED | `publish-mirror.ts:166-168` filters via `isServerProducedKey`; `publish-mirror.spec.ts:77-97` fixture includes `nx-cache-zzz` rejected, only `aa11`/`bb22` restored |
| 4 | TRUST-08: Actions-cache backend derives its key through `cacheKeyFor` from the leaf | VERIFIED | `actions-cache-backend.ts:4,30,63` imports+uses `cacheKeyFor` from `../lib/cache-key.js`; local definition removed |
| 5 | TRUST-08: server's SRV-03 hash validation and the TRUST-08 filter share ONE `HASH_PATTERN` | VERIFIED | `server.ts:3,90` imports `HASH_PATTERN` from `../lib/cache-key.js`; `cache-key.ts:21` sole declaration |
| 6 | TRUST-01: `isWriteTrusted` admits `pull_request`/`release` only on `github.com` or a real `*.ghe.com` subdomain, fail-closed on GHES/malformed/empty | VERIFIED | `trust.ts:35-46,55-71`; `trust.spec.ts` host-detection matrix (ON/GHES/malformed/bare-`.ghe.com`/attacker-suffix all covered) |
| 7 | TRUST-01: `push`/`schedule` trusted on ANY host (host-independent base) | VERIFIED | `trust.ts:23,62-64`; `trust.spec.ts` base-events-host-independent tests |
| 8 | TRUST-01: dangerous trio + unlisted events refused on EVERY host, incl. `github.com` | VERIFIED | `trust.spec.ts` REFUSED_EVENTS-with-github.com-host tests; `select-backend.spec.ts:81,290` `pull_request_target` refused even with a guarded host |
| 9 | TRUST-01: host detection is a structural `URL(...).hostname` parse, never `includes()`/substring | VERIFIED | `trust.ts:39-45` (`new URL(raw).hostname`, `=== 'github.com' \|\| endsWith('.ghe.com')`); rejects `github.com.attacker.com`, `ghe.com`, `notghe.com` (tested) |
| 10 | TRUST-01: widening flows through `selectBackend` (writable on github.com, read-only on GHES); `select-backend.ts` unedited | VERIFIED | `select-backend.spec.ts:164-` "host-gated widening flows through isWriteTrusted"; `select-backend.ts` still calls `isWriteTrusted(env)` unmodified |
| 11 | TRUST-01 regression: write-widen did NOT widen the sync gate -- `isSyncTrusted` still refuses `pull_request`/`release` on a github.com host | VERIFIED | `trust.spec.ts:176-204` cross-check imports `isSyncTrusted` from `./sync-gate.js`; `sync-gate.ts:13` `SYNC_EVENTS` unchanged `['push','schedule']`; `git grep sync-gate trust.ts` (prod file) returns nothing |
| 12 | TRUST-04: committed `.cjs` reproduces `isWriteTrusted` verdicts identical to `trust.ts` across the full env matrix | VERIFIED | `trust.generated.spec.ts:72-102` (3x8x6=144 combinations + non-vacuous both-verdicts check), all green |
| 13 | TRUST-04: `.cjs` `TRUSTED_EVENTS`/`HOST_GATED_EVENTS` deep-equal `trust.ts`'s arrays | VERIFIED | `trust.generated.spec.ts:104-112` |
| 14 | TRUST-04: `selfcheck.cjs` regenerates in-memory and exits 1 (stderr) on drift, exit 0 in sync | VERIFIED | Ran `node packages/github-cache/selfcheck.cjs` live during this verification -> `selfcheck: ... is in sync ...`, exit 0; drift-exit-1 path reviewed in `selfcheck.cjs:151-170` and reproduced by 05-03-SUMMARY's recorded manual mutation proof |
| 15 | TRUST-04: `.cjs` is dependency-free CommonJS (node builtins only) | VERIFIED | `trust.generated.cjs:9` sole `require('node:url')`; `git grep "require("` in the file returns only that line |
| 16 | TRUST-04: selfcheck runs in CI as part of the check battery | VERIFIED | `.github/workflows/ci.yml:52-61` `selfcheck` job -> `npm run selfcheck`; `package.json:14` script wired |
| 17 | TRUST-06: `ppe/action.yml` is a composite action (`using: composite`) an adopter consumes as a step, supplying its own runner + checkout | VERIFIED | `ppe/action.yml:31-32`; `ppe-action.spec.ts:38-40` |
| 18 | TRUST-06: self-installs EXACT-pinned `zizmor==1.27.0` (pipx) + `actionlint 1.7.12` (official download script), consumer never provides the tools | VERIFIED | `ppe/action.yml:34-41`; `ppe-action.spec.ts:42-48` (mutation-proven per 05-04-SUMMARY) |
| 19 | TRUST-06: gate runs advisory (`--no-exit-codes` / swallowed actionlint exit) -- never fails the consumer's job by default | VERIFIED | `ppe/action.yml:47,51`; `ppe-action.spec.ts:50-52` |
| 20 | TRUST-06: positioned as best-effort/advisory defense-in-depth in name+description, never the containment control | VERIFIED | `ppe/action.yml:1-22` (name/description explicitly say "NOT the containment control"); `ppe-action.spec.ts:54-57` |
| 21 | TRUST-06: config-assertion spec proves composite structure + both pins + advisory posture from the tracked `action.yml`, mutation-proven | VERIFIED | `ppe-action.spec.ts` (6 tests green); mutation-proof documented in 05-04-SUMMARY (pin-change fails the spec) |
| 22 | TRUST-06 (live): the PPE composite action actually runs zizmor/actionlint against the fixture on a real runner and emits findings while the job passes (advisory) | ? UNCERTAIN (human_needed) | `ci.yml:74-80` `ppe` job wired against `ppe/fixtures/unsafe-workflow.yml`, but the tools' live execution/finding-production requires a real GitHub-hosted runner (self-installs pipx/curl-fetched binaries) -- not reproducible in local Vitest. Explicitly flagged `human_judgment: true` / status `unknown` in 05-04-SUMMARY's own coverage table (D2). Same first-push-close pattern as Phase 4's cross-OS mirror round-trip. |

**Score:** 21/22 truths verified (1 present, live-CI-only, human-verification needed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/github-cache/src/lib/cache-key.ts` | Single-source leaf: `CACHE_KEY_PREFIX`, `HASH_PATTERN`, `cacheKeyFor`, `isServerProducedKey` | VERIFIED | Exists, substantive (39 lines, full filter logic), true leaf (no imports) |
| `packages/github-cache/src/lib/cache-key.spec.ts` | Admit/reject matrix, round-trip, single-source count | VERIFIED | 14 tests green incl. strict cross-file count===1 assertion |
| `packages/github-cache/src/lib/trust.ts` | Widened `HOST_GATED_EVENTS` + `hostSupportsWidenedTrust` | VERIFIED | 71 lines; widened logic present and wired |
| `packages/github-cache/src/lib/trust.spec.ts` | Host-detection matrix + widened events + refusal + sync cross-check | VERIFIED | 42 tests green, includes the ADR C2 cross-check |
| `packages/github-cache/selfcheck.cjs` | Generator + drift tripwire | VERIFIED | 179 lines; ran live, exits 0 in sync |
| `packages/github-cache/src/action/trust.generated.cjs` | Committed dependency-free `.cjs` | VERIFIED | Generated banner present; mirrors trust.ts logic verbatim; matches a fresh `--write` regeneration |
| `packages/github-cache/src/lib/trust.generated.spec.ts` | Full-matrix semantic parity | VERIFIED | 147 tests green |
| `ppe/action.yml` | Composite PPE-hygiene action | VERIFIED | 52 lines; composite, exact pins, advisory posture, per-step `shell:`, no top-level `env:` |
| `ppe/fixtures/unsafe-workflow.yml` | Known-unsafe scan target, outside `.github/workflows` | VERIFIED | `git ls-files` confirms path is `ppe/fixtures/unsafe-workflow.yml` (not under `.github/workflows`) |
| `packages/github-cache/src/ppe/ppe-action.spec.ts` | Config-assertion, mutation-proven | VERIFIED | 6 tests green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `actions-cache-backend.ts` | `../lib/cache-key.js` | `import { cacheKeyFor }` | WIRED | Line 4; local definition removed |
| `publish-mirror.ts` | `../lib/cache-key.js` | `import { CACHE_KEY_PREFIX, isServerProducedKey }` | WIRED | Line 3; filter applied at line 167 |
| `server.ts` | `../lib/cache-key.js` | `import { HASH_PATTERN }` | WIRED | Line 3; SRV-03 guard at line 90 unchanged |
| `isWriteTrusted` | `hostSupportsWidenedTrust` | internal call, reads `GITHUB_SERVER_URL` | WIRED | `trust.ts:67` |
| `selectBackend` | `isWriteTrusted` | unchanged call-through | WIRED | `select-backend.ts:36` (file NOT edited, per plan) |
| `selfcheck.cjs` | `src/lib/trust.ts` (source) | `readFileSync` + regex extraction | WIRED | `selfcheck.cjs:29,81` reads TS source, not dist |
| `trust.generated.spec.ts` | `../action/trust.generated.cjs` | `createRequire(...).require(...)` | WIRED | Line 21 |
| `ci.yml` selfcheck job | `packages/github-cache/selfcheck.cjs` | `npm run selfcheck` | WIRED | `ci.yml:61` |
| `ppe-action.spec.ts` | `../../../../ppe/action.yml` | `readFileSync` via `import.meta.url` | WIRED | Line 27-30 |
| `ci.yml` ppe job | `./ppe` composite + fixture | `uses: ./ppe` with `path: ppe/fixtures/unsafe-workflow.yml` | WIRED | `ci.yml:74-80` |

### Decisions & Prohibitions Honored (05-CONTEXT.md)

| Decision | Check | Result |
|----------|-------|--------|
| D-01 (host-detection, fail-closed) | pure fn of `GITHUB_SERVER_URL`, no caller flag | HONORED -- `isWriteTrusted(env = process.env)`, single param |
| D-02 (default-only, no override surface) | no custom allowlist config code | HONORED -- `git grep` for allowlist-override symbols returns nothing |
| D-03 (GHES version-gate dormant) | no live GHES-enabling knob | HONORED -- `git grep` for version-gate symbols returns nothing |
| D-04 (spoof cross-check deferred) | no `/meta` / `installed_version` code | HONORED -- `git grep` returns nothing |
| D-05 (single TS source) | one `TRUSTED_EVENTS` declaration | HONORED -- `trust.ts` sole declaration; `.cjs` is generated, not authored |
| D-06 (generated action copy) | `.cjs` produced by codegen, banner present | HONORED -- `trust.generated.cjs:1-6` banner |
| D-07 (selfcheck parity, CI-wired) | drift fails CI | HONORED -- `ci.yml` selfcheck job; live-ran selfcheck, exit 0 |
| D-08 (full nx-cache- filter, not startsWith-only) | prefix + HASH_PATTERN | HONORED -- `isServerProducedKey` |
| D-09 (TRUST-08 ships FIRST) | 05-01 is wave 1, before widening | HONORED -- ROADMAP wave order; git log shows 05-01 commits precede 05-02 |
| D-10 (composite action form) | `using: composite` | HONORED |
| D-11 (self-installed exact-pinned tools) | `zizmor==1.27.0`, `actionlint 1.7.12`, no range | HONORED |
| D-12 (named patterns, advisory) | `--no-exit-codes` / swallowed exit; advisory framing | HONORED |
| Prohibition: `trust.ts` MUST NOT import `sync-gate.ts` | `git grep` on prod file | HONORED (import exists only in the test file `trust.spec.ts`, which is the required regression cross-check) |
| Prohibition: dangerous trio never added to allowlists | content-pin tests | HONORED |
| Prohibition: fixture outside `.github/workflows` | `git ls-files` | HONORED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TRUST-01 | 05-02 | Write-trust allowlist widened, host-detected, fail-closed on GHES | SATISFIED | Truths 6-11; REQUIREMENTS.md line 48 marked `[x]` |
| TRUST-04 | 05-03 | Single-source allowlist + generated dependency-free copy + selfcheck parity | SATISFIED | Truths 12-16; REQUIREMENTS.md line 51 marked `[x]` |
| TRUST-06 | 05-04 | Shipped installable PPE-hygiene gate, advisory | SATISFIED (structure); live-run confirmation open | Truths 17-22; REQUIREMENTS.md line 53 marked `[x]` |
| TRUST-08 | 05-01 | Mirror publishes only server-produced keys | SATISFIED | Truths 1-5; REQUIREMENTS.md line 55 marked `[x]` |

No orphaned requirements found for Phase 5 (`.planning/REQUIREMENTS.md:118` lists exactly these 4 IDs for Phase 5; all 4 appear in a plan's `requirements:` frontmatter).

### Anti-Patterns Found

None. Scanned all 19 files modified across the 4 plans (`cache-key.ts`, `cache-key.spec.ts`, `actions-cache-backend.ts`+spec, `publish-mirror.ts`+spec, `server.ts`, `trust.ts`, `trust.spec.ts`, `select-backend.spec.ts`, `selfcheck.cjs`, `trust.generated.cjs`, `trust.generated.spec.ts`, `ci.yml`, `package.json`, `.fallowrc.jsonc`, `ppe/action.yml`, `ppe/fixtures/unsafe-workflow.yml`, `ppe-action.spec.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and placeholder/coming-soon language -- zero matches.

**Info flag (not a blocker):** `ppe/action.yml`'s actionlint install step fetches `download-actionlint.bash` from the `rhysd/actionlint` repo's `main` branch (unpinned script provenance), while the actionlint *binary version itself* is exact-pinned (`1.7.12`, passed as a script argument). This is a supply-chain review note for a future hardening pass (e.g. pinning the script to a tag/commit SHA), not a verification blocker -- the shipped artifact still installs the exact-pinned binary version regardless of script drift, and 05-RESEARCH.md's Package Legitimacy Audit already reviewed this as the official install path.

### Automated Check Battery (run live during this verification)

| Check | Result |
|-------|--------|
| `npx nx test github-cache` | 424 tests / 21 files, all green |
| `npx nx typecheck github-cache` | green |
| `npx nx build github-cache` | green |
| `node packages/github-cache/selfcheck.cjs` | exit 0, "in sync" |
| `npm run fallow:ci` | 0 issues (32 entry points) |
| `npx nx format:check --all` | exit 0 |
| `git status --short` | clean working tree |
| All cited commit hashes (5008547, 3880701, 33fc814, 5cbc5bb, 41312fd, 988e420, 3886e55, 9f9559a, f0325b0, b63a981, ab76c2a) | all resolve as real commits |

### Human Verification Required

### 1. PPE advisory CI job -- live findings-produced confirmation

**Test:** On the next default-branch push, observe the `ppe` job in `.github/workflows/ci.yml` (self-installs zizmor 1.27.0 + actionlint 1.7.12, scans `ppe/fixtures/unsafe-workflow.yml`).
**Expected:** zizmor and/or actionlint emit findings (dangerous-triggers / template-injection / unpinned-uses) as annotations for the fixture's `pull_request_target` + PR-head-checkout + untrusted-expression pattern; the job itself PASSES (advisory, non-blocking).
**Why human:** Requires a real GitHub-hosted runner to self-install external tools and execute them -- not reproducible in local Vitest. This is the same "first-push closing proof" pattern used for Phase 4's cross-OS mirror round-trip. All locally-verifiable structure (composite form, exact pins, advisory switches, not-containment framing) is already mutation-proven by `ppe-action.spec.ts` (6/6 green).

### Gaps Summary

No gaps. All 4 requirement IDs (TRUST-01, TRUST-04, TRUST-06, TRUST-08) and all 4 ROADMAP.md Phase 5 Success Criteria are satisfied by code that exists, is substantive, and is wired -- confirmed by direct inspection of `cache-key.ts`, `trust.ts`, `sync-gate.ts`, `selfcheck.cjs`, `trust.generated.cjs`, and `ppe/action.yml`, plus a live re-run of the full authoritative check battery (424 tests, typecheck, build, selfcheck, fallow:ci, format:check -- all green) rather than trusting SUMMARY.md claims. The D-09 sequencing (TRUST-08 shipping before TRUST-01 widening) is honored per wave order. All three explicitly-deferred decisions (D-02 custom override surface, D-03 GHES version-gate knob, D-04 `/meta` spoof cross-check) were correctly NOT built.

The only open item is the live-CI first-push confirmation that the PPE composite action's self-installed tools actually produce findings against the fixture -- this is an expected, pre-announced deferral (documented in 05-04-SUMMARY.md's own coverage table as `status: unknown`, `human_judgment: true`), not a code gap. It does not block phase completion; it is recorded here for the developer to confirm on the next default-branch CI run.

---

*Verified: 2026-07-20T18:39:56Z*
*Verifier: Claude (gsd-verifier)*
