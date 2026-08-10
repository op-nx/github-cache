---
phase: 07-lint-toolchain-and-the-ambient-platform-read-ban
status: secured
threats_open: 0
threats_total: 22
threats_closed: 22
asvs_level: 1
block_on: high
audited: 2026-07-28
audit_base: 7b451ca..HEAD
---

# Phase 07 Security Audit

**Phase:** 07 - Lint Toolchain and the Ambient-Platform-Read Ban
**Threats closed:** 22 / 22
**ASVS level:** 1 (verify the mitigation is PRESENT in the cited file)
**Block-on threshold:** high
**Blocking open threats:** 0

Register assembled from the four `<threat_model>` blocks in `07-01-PLAN.md` (T-07-01..07),
`07-02-PLAN.md` (T-07-08..12), `07-03-PLAN.md` (T-07-13..17) and `07-04-PLAN.md`
(T-07-18..22). Every threat was verified against code or recorded evidence at HEAD, not
against plan or summary prose.

## Method

- Diff frame: `git diff 7b451ca..HEAD` (phase base recorded in `07-EVIDENCE.md:12`).
- Live checks run read-only: `npm run lint -- --skip-nx-cache` (exit 0, "Successfully ran
  target lint", 1.6 s, cache skipped) and `npx vitest run` over the four guard specs
  (`lint-rules`, `lint-scope-drift`, `pinned-deps`, `nx-target-inputs`) -> 80 / 80 passed.
- `git grep` for tracked files, `rg` for `start-cache-server/index.js` and `node_modules`.
  Every negative result was preceded by a positive control on the same file.
- No implementation file was modified. This document is the only file this audit writes.

## Threat verification

| Threat | Category | Severity | Disposition | Verified in code / evidence | Verdict |
|---|---|---|---|---|---|
| T-07-01 | Tampering | high | mitigate | Five names all from the completed audit at `07-RESEARCH.md:1041-1046` (5 OK, 0 SLOP, 0 SUS). Exact pins live at `package.json:26,27,28,37,43`. The one second-hand entry re-fetched at install time, `07-EVIDENCE.md:33-40`. | CLOSED |
| T-07-02 | Tampering | high | mitigate | `07-EVIDENCE.md:14-31`: five-row `npm view <pkg> scripts.postinstall` table, all empty, run BEFORE install, plus a second pass over the whole `scripts` object ruling out `preinstall`/`install`. | CLOSED |
| T-07-03 | Tampering | medium | mitigate | `packages/github-cache/src/pinned-deps.spec.ts:102-133` - five explicit `it()` blocks, one per package, no `it.each`, no `Object.keys` loop. Anchored `EXACT_SEMVER = /^\d+\.\d+\.\d+$/` at `:80`, so `^9.39.5` or `~9.39.5` fails. Live: 11 / 11. | CLOSED |
| T-07-04 | Tampering | high | mitigate | `07-EVIDENCE.md:42-68` - container invocation verbatim (`--platform linux/arm64`, `node:24`, anonymous `node_modules` volume), plus the 15 `@emnapi` / `wasm32-wasi` subtrees a Windows install prunes verified PRESENT. | CLOSED |
| T-07-05 | Tampering | medium | mitigate | `git show db577db --stat` - `package-lock.json` and `start-cache-server/index.js` in the SAME commit, nothing else. `07-EVIDENCE.md:70-88` records the cause and the re-verified `check:action`. See the ME-05 independent assessment below. | CLOSED |
| T-07-06 | Repudiation | medium | mitigate | `eslint.config.mjs:185` (`reportUnusedDisableDirectives: 'error'`) and `:190` (`@eslint-community/eslint-comments/require-description: 'error'`). Proven live, not merely configured, by M8 / M9 at `07-EVIDENCE.md:794-795`. | CLOSED |
| T-07-07 | Tampering | low | accept | `.fallowrc.jsonc:63` is the only pre-emptive entry (`@nx/eslint`, with a rationale comment). Q2 resolved favourably, so no speculative `entry` line was added. Accepted-risk entry logged below. | CLOSED (accepted) |
| T-07-08 | Tampering | high | mitigate | `eslint.config.mjs:278-304` (4 `paths`) and `:365+` (P1..P7 plus ME-02's `process.env` selectors), scoped at `:263-264`. Verdicts asserted at `lint-rules.spec.ts:353` (`EVASION_SHAPES`) and `:569` (`CORR_05_SITES`). M1 / M2 produce DISJOINT red sets, M3 red - `07-EVIDENCE.md:787-789`. Live: 46 / 46. | CLOSED |
| T-07-09 | Repudiation | high | mitigate | Four described disables at `cache-archive-path.spec.ts:6`, `releases-backend.spec.ts:38`, `release-asset-name.spec.ts:39` and `:61`. Guard at `lint-rules.spec.ts:656-676`. See the HI-02 assessment below. | CLOSED (strengthened) |
| T-07-10 | Tampering | medium | mitigate | Declared mitigation SUPERSEDED by review finding ME-01. The shipped control is three real-config mirrors at `lint-scope-drift.spec.ts:287-360`. See the ME-01 assessment below. | CLOSED (amended) |
| T-07-11 | Spoofing | low | accept | Three-part ceiling comment present at `eslint.config.mjs:311-319`, naming the limit and the upgrade path (allowlist, never bare removal of the `object.name` constraint). | CLOSED (accepted) |
| T-07-12 | Tampering | low | accept | Ceiling comment at `eslint.config.mjs:333-339`, plus ME-03's two indirect module-loading ceilings at `:340`. Upgrade path (type-aware linting) named and excluded by D-11 for a stated reason. | CLOSED (accepted) |
| T-07-13 | Tampering | high | mitigate | `nx.json:147-163` - `outputs: []`, five-entry `inputs` with all FOUR ESLint `externalDependencies`, replacing the inferred single-entry set. Probes in `nx-target-inputs.spec.ts` (17 / 17 live). Behavioural half: NC1 reproduces the stale HIT, `07-EVIDENCE.md:661+`. | CLOSED |
| T-07-14 | Tampering | high | mitigate | Global standalone `ignores` object at `eslint.config.mjs:98-106` (5 stems). NC2: 66 / 66 linted files across `rm -rf dist out-tsc`. M7 shows the control can fail: 66 -> 159 (`07-EVIDENCE.md:793`). | CLOSED |
| T-07-15 | Spoofing | medium | mitigate | `.github/workflows/ci.yml:37-80`. See the CI job assessment below. | CLOSED (strengthened) |
| T-07-16 | Tampering | medium | accept | Rotation isolated in `b3fdf6d`; D-36 pre-record at `07-EVIDENCE.md:873+` names all three legitimate rotation windows and the tripwire wording Phase 9 must use. | CLOSED (accepted) |
| T-07-17 | Tampering | medium | transfer | `07-EVIDENCE.md:498-523` records all six hashed node fields including the resolved `options.cwd`, and states `metadata` is not hashed. `:846-872` states in as many words that OS-divergent inference is UNVERIFIED BY DESIGN and is transferred to Phase 8 CORR-03, not reasoned closed. | CLOSED (transferred) |
| T-07-18 | Repudiation | high | mitigate | Nine-row table with OBSERVED failure sets and a per-row match verdict at `07-EVIDENCE.md:787-795`. Residual noted below (the M4 row predates ME-01). | CLOSED (with residual) |
| T-07-19 | Tampering | high | mitigate | `git diff 7b451ca..HEAD -- . ':!.planning'` shows 14 files, none of them a mutated variant; `git diff --name-only 7b451ca..HEAD -- packages/github-cache/src` filtered of `*.spec.ts` is EMPTY, so no non-spec source moved. Tree clean at audit time apart from this file. | CLOSED |
| T-07-20 | Repudiation | high | mitigate | Five-row differential at `07-EVIDENCE.md:661+` with the cache line on BOTH sides and base SHA `81048ca`. NC1 (`1/1 hit` across a real rule edit) is the load-bearing one and the record says so. The confounded first attempt at Measurement B is recorded, not discarded. | CLOSED |
| T-07-21 | Info disclosure | low | accept | Scanned `07-EVIDENCE.md` for token shapes, bearer values and private paths: none. No work-domain string present. | CLOSED (accepted) |
| T-07-22 | Repudiation | medium | transfer | Same evidence as T-07-17; the transfer statement is explicit and the acceptance criterion asserting it was met. | CLOSED (transferred) |

## The consumer-facing delta: independent assessment of ME-05 (undici 6.27.0 -> 6.28.0)

**Verdict: ME-05's conclusion CONFIRMED. Its stated mechanism is inaccurate, and the true
mechanism makes the conclusion stronger, not weaker.**

Verified independently:

1. The delta is real and reaches consumers. `package-lock.json:8775-8778` carries undici
   `6.28.0`; `git show db577db -- package-lock.json` shows the `6.27.0 -> 6.28.0` line pair.
   The new predicate is in the shipped bundle at `start-cache-server/index.js:1360`:
   `var headerCharRegex = /[^\t\x20-\x7e\x80-\xff]/`. It rejects only C0 control characters
   other than tab. Tab, all printable ASCII and the whole high-byte range pass. ME-05's
   characterisation of the predicate is exact.

2. The repo's own `fetch` sites do not use the bundled copy. Five call sites
   (`src/action/index.ts:234`, `:254`; `src/backend/releases-backend.ts:190`, `:210`,
   `:242`) call the bare global `fetch`. `git grep` finds no `undici` import anywhere in
   source, and the bundle contains no `fetch` shim or `globalThis.fetch` assignment. They
   therefore resolve to node 24's built-in undici, not the inlined one. CONFIRMED.

3. ME-05 says the bundled copy "is reached only by `@actions/cache` with literal header
   values plus a runner-injected JWT". That is not what the bundle does. The bundled undici
   is required exactly once, by `@actions/http-client`
   (`start-cache-server/index.js:27800`), and the module object is dereferenced exactly once
   in the entire 30k-line bundle, at `:28345`:
   `new import_undici.ProxyAgent(...)` inside `HttpClient._getProxyAgentDispatcher`. That is
   reachable only from `HttpClient.getAgentDispatcher()` (`:28190`), and
   `rg "\.getAgentDispatcher\("` over the bundle returns ZERO call sites.
   `@actions/http-client`'s real request path uses node `http`/`https` with
   `options.agent = this._getAgent(...)` (`:28214`), and `@azure/core-rest-pipeline`
   (`:32329+`, the cache-v2 blob path) carries its own node HTTP client. So the new
   `processHeader` throw is not merely un-hittable with the current header values: it is
   UNREACHABLE from any code path in the artifact.

**Consumer exposure: none.** The bundled undici is dead weight in the current bundle, and
its behaviour change cannot be observed by an adopter.

One honest caveat, recorded rather than buried: this is a reachability argument over the
bundle as it stands today. If a future `@actions/*` bump starts calling
`getAgentDispatcher()` (the HTTP-proxy path, active only when `http_proxy`/`https_proxy` is
set), the bundled undici becomes live and the header validation would apply to whatever that
path carries. That is a future-bump concern, not a Phase 7 finding.

## Trust surface: verified UNCHANGED

| Claim | Check | Result |
|---|---|---|
| `packages/github-cache/package.json` byte-identical | `git diff --exit-code 7b451ca..HEAD` | clean |
| `public-surface.spec.ts` byte-identical | `git diff --exit-code 7b451ca..HEAD` | clean |
| `action.yml` byte-identical (no new action input) | `git diff --exit-code 7b451ca..HEAD` | clean |
| no new export | implied by the three above plus: no non-spec source file changed | verified |
| no new env knob | `git diff --name-only 7b451ca..HEAD -- packages/github-cache/src` filtered of `*.spec.ts` is EMPTY | verified |
| C1-C18 CREEP controls untouched | `sync-gate.ts` (`SYNC_EVENTS:15`, `isSyncTrusted:63`, `isTrustedSyncEvent:117`), `trust.ts` (`TRUSTED_EVENTS:32`, host gate `:88`) - none in the phase diff | verified |
| workflow `permissions:` unchanged | `ci.yml:9-10` still `contents: read`; the phase diff touches only the added `lint` job block | verified |

The only non-planning files the phase touched are: `.fallowrc.jsonc`, `.github/workflows/ci.yml`,
`eslint.config.mjs`, `nx.json`, `package-lock.json`, `package.json`, four spec files receiving
comment-only additions, two new spec files, `nx-target-inputs.spec.ts`, `pinned-deps.spec.ts`,
and the regenerated `start-cache-server/index.js`.

## The new CI job (T-07-15)

`.github/workflows/ci.yml:37-80`.

| Property | Finding |
|---|---|
| Triggers | Workflow-level `on:` is `push` to `main` plus `pull_request` (`:3-7`). NO `pull_request_target` anywhere in the file. No `workflow_run`, no `issue_comment`. |
| Permissions | No job-level `permissions:` block, so it inherits the workflow-level `contents: read` (`:9-10`). Least privilege by inheritance. The only job in the file with an elevated block is `publish` (`:662`). |
| Secrets | Zero `secrets.*` references in the job body. The first `GITHUB_TOKEN` in the file is a comment at `:161`; the first real one is `build` at `:242`. No token reaches `lint`. |
| Sidecar | D-33 honoured: no background sidecar step, no `cancel:` step, no `NX_*` vars, no build step. Verified by reading the whole job block. |
| Runner | `ubuntu-24.04-arm`, same as every sibling gate. |
| Post-review hardening (CR-01) | The job does NOT run a bare `npm run lint`. It pipes through `tee` and requires the literal `Successfully ran target lint`, because `nx run-many` with no matching target prints "No tasks were run" and exits 0. Given that OS-divergent inference is an accepted live risk (T-07-17), a bare exit-code check would have converted a missing target into a GREEN leg. `NO_COLOR: '1'` is set so the plain-text match survives Nx's ANSI bolding. |

No new secret exposure, no `pull_request_target`-class hazard, no privilege escalation.
The job does run `npm ci` on fork PRs, which executes lockfile lifecycle scripts, but every
sibling job already does the same under the same read-only token, and the five new packages
were postinstall-cleared under T-07-02. No new exposure.

Informational, not a finding: the `lint` job pins `actions/checkout@v7` and
`actions/setup-node@v6` by tag rather than SHA. That is the pre-existing convention for all
eleven jobs in this workflow and is not something Phase 7 introduced or worsened.

Also informational: the `ppe` job (`ci.yml:144-150`) runs the shipped composite action over
`ppe/fixtures/unsafe-workflow.yml`, not over this repository's own `ci.yml`. So C4's
`zizmor`/`actionlint` hygiene gate did NOT independently vet the new `lint` job. C4 is
documented as best-effort and advisory in `.planning/THREAT-MODEL.md:68`, and the manual
review above covers the same ground, so this is a pre-existing coverage shape rather than a
Phase 7 regression.

## The repudiation control this phase creates (HI-02)

LINT-05 (`require-description`) plus LINT-06 (`reportUnusedDisableDirectives: 'error'`) exist
so a lint opt-out cannot be silent. The code review found that the control had a hole and
that one of the four disables exploited it.

**The fix in `2cc6203` genuinely tightened the control. It is not a prose edit.** Both halves
verified at HEAD:

- Guard half, `packages/github-cache/src/lint-rules.spec.ts:671`:
  `const prose = reason.replace(/\S+\.integration\.spec\.[cm]?ts/g, '');` with the
  `toContain('integration')` now applied to `prose`, not to `reason`. The regex covers
  `.ts`, `.cts` and `.mts`. Before the fix, the word was satisfiable by the substring inside
  a path token such as `public-server.integration.spec.ts`. That is a real behaviour change
  in the assertion, and the commit records the RED proof: with the old reason text restored
  under the tightened guard, exactly 1 of 42 fails, and it is site 4's reason assertion.
- Content half, `packages/github-cache/src/lib/release-asset-name.spec.ts:61`: the reason no
  longer recommends the move it was supposed to argue against. It now names the blocking
  constraint (Phase 10 owns the site, CORR-02 makes the explicit call, OBS-03 keeps
  `cachePlatform`, moving early destroys the LINT-03 evidence) and relocates the candidate
  destination to the `CORR_05_SITES` table where a recommendation belongs.

Residual, recorded rather than claimed away: the guard enforces the WORD in surviving prose,
not the ARGUMENT. Sites 1 through 3 argue "moving gains nothing" rather than "cannot move",
which is a softer reading of LINT-06. That was declined deliberately and is on record at
`07-REVIEW-FIX.md:298-301` as a decision about how strictly the requirement reads, not a
review fix. Severity low; below the `high` block threshold; not counted in `threats_open`.

## ME-01: the D-19 identity invariant was itself the hole

Recorded prominently because it is the one case in this phase where a declared mitigation was
verifiably WRONG rather than merely absent, and it was caught by code review rather than by
the phase's own guard.

T-07-10's declared mitigation reads: "The D-19 drift guard asserts identity between the two
sets and superset over the integration include." That invariant compared the two ESLint globs
only to EACH OTHER. It had no term for the test runner, so both globs could sit narrower than
the runner in lockstep and stay green. They did. The ban covered `**/*.spec.{ts,mts,cts}`
while the unit runner collects `{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`, so
`*.test.ts`, `*.spec.tsx`, `*.spec.cjs`, `*.spec.js`, `*.spec.mjs`, `*.spec.jsx` ran as unit
tests with the ambient-platform ban silently OFF for the whole of plans 07-01 through 07-04.

Closed at HEAD by `a6af663`. The shipped control is three mirrors read off the REAL configs,
at `packages/github-cache/src/lint-scope-drift.spec.ts`:

1. `:287-306` ESLint `files` == `vitest.config.mts` `include` (what runs as a unit test).
2. `:314-331` ESLint `ignores` == `vitest.config.mts` `exclude` (deliberately NOT the
   include; tracking the include would exempt `*.integration.spec.tsx`, which the
   integration runner does not collect and the unit exclude does not catch).
3. `:340-360` unit `exclude` == integration `include`, which is what the superseded
   superset invariant was reaching for, stated exactly.

The two ESLint globs are now ASYMMETRIC on purpose (`eslint.config.mjs:236-264`), with a
header comment forbidding the "tidy" that would reintroduce the hole in the other direction.
The replacement was re-proven RED with fresh mutations, recorded in `a6af663`'s commit body:
mutating `ignores` to match `files` PASSES under the old invariant and FAILS under the new
one. Live at audit time: 6 / 6 in that spec, and the ban verified firing at all eight
extensions.

Marked CLOSED (amended) rather than open: the shipped control is strictly stronger than the
one the plan declared, and it is present, live, and independently mutation-proven.

## ASVS L1 category assessment

`07-RESEARCH.md:1010-1022` scoped V14 as the only applicable category. That scoping was
tested, not inherited.

| Category | RESEARCH verdict | Audit verdict | Basis |
|---|---|---|---|
| V2 Authentication | not applicable | CONFIRMED | No non-spec source changed. `sync-gate.ts` and `trust.ts` are outside the phase diff. No new action input, no new env knob. |
| V3 Session Management | not applicable | CONFIRMED | No session surface exists in this codebase and none was added. |
| V4 Access Control | not applicable | CONFIRMED, and independently checked | `TRUSTED_EVENTS` (`trust.ts:32`), `SYNC_EVENTS` (`sync-gate.ts:15`) and the host gate (`trust.ts:88`) are byte-identical. Workflow `permissions:` unchanged at `contents: read`. The new job adds no token and no privilege. |
| V5 Input Validation | not applicable | CONFIRMED | No runtime input path changed. The only new parsing is inside guard specs and reads this repo's own config files off disk. |
| V6 Cryptography | not applicable | CONFIRMED | Nothing crypto-adjacent in the diff. The loopback bearer token generator is untouched. |
| V14 Configuration / Dependency | APPLIES | APPLIES, and RESEARCH's justification is NARROWER than the phase's real V14 surface | See below. |

**Where the scoping was too quick.** RESEARCH's V14 row justifies the category solely on "five
new devDependencies, all exact-pinned and NAME-guarded; lockfile regenerated in a controlled
container". Two further V14 items landed in this phase and are not named there:

- **The new CI job is configuration.** Covered by the register at T-07-15 and verified above,
  so nothing is unmitigated, but the ASVS table does not point at it.
- **A transitive RUNTIME dependency changed in the SHIPPED artifact.** The register's only
  coverage of the bundle is T-07-05, which is a DRIFT-DETECTION threat ("rebuild and stage in
  the same commit so the gate cannot fail later"). Nothing in the register asks what the new
  bytes DO. That question had to be raised by the code reviewer as ME-05 after the fact. It
  is now answered twice, independently, with the same verdict, so no exposure remains - but
  the register shape is worth carrying into Phase 8 and beyond: a phase that regenerates a
  lockfile should carry a delta-assessment threat, not only a drift-detection one.

Neither item is an open threat. Both are logged as unregistered flags below.

## Unregistered flags (WARNING, non-blocking)

| # | Flag | Why it matters | Status |
|---|---|---|---|
| UF-1 | `## Threat Flags` section is MISSING from `07-01-SUMMARY.md` and `07-02-SUMMARY.md`. Present and "None" in `07-03` and `07-04`. | 07-01 is precisely the plan that shipped the consumer-facing undici bump. The section that exists to surface new attack surface was absent from the plan that created some. | Recorded. No action required of Phase 7; worth enforcing in the summary template. |
| UF-2 | The undici `6.27.0 -> 6.28.0` transitive runtime bump in the shipped consumer bundle. | New attack surface in the artifact adopters resolve from the git ref, mapped by the register only as a drift-detection threat (T-07-05), not as a delta assessment. | Assessed by ME-05 and independently re-assessed above. No reachable exposure. Closed by assessment. |
| UF-3 | The ambient-platform ban was silently OFF for six spec-name/extension combinations for the whole of plans 07-01..07-04, and the phase's own D-19 guard could not see it. | The failure mode was in the invariant, not in its implementation. Found by code review (ME-01), not by the guard. | Closed at HEAD by `a6af663`; superseding invariant verified live above. |
| UF-4 | `07-EVIDENCE.md:790`'s M4 row names the assertion `applies the ban to exactly the extension set it exempts`, which ME-01 deleted. | The mutation record no longer describes the shipped guard, so a future reader re-checking M4 will not find the assertion. | Replacement RED proof exists in `a6af663`'s commit body and `07-REVIEW-FIX.md`. Evidence file not back-annotated. Low. |

## Accepted risks log

| ID | Risk | Severity | Rationale on record |
|---|---|---|---|
| T-07-07 | A speculative `.fallowrc.jsonc` `ignoreDependencies` entry would suppress a real future finding. | low | Mitigated by policy, not mechanism. Only `@nx/eslint` was added pre-emptively (`.fallowrc.jsonc:63`), which is the identical case to the existing `@nx/vitest` entry. Q2 resolved favourably so the contingency `entry` line was never needed. |
| T-07-11 | A namespace import bound to an unconventional local name is invisible to selectors P4 and P5. | low | The imports rule reports the namespace import itself regardless of local name, and the dynamic form is closed by P6. Recorded as a named three-part ceiling with its upgrade path at `eslint.config.mjs:311-319`, not left implicit. |
| T-07-12 | A platform read hidden behind a helper in another module reaches no syntactic selector. | low | Out of reach for any non-type-aware rule. Type-aware linting is excluded by D-11 for a stated stale-cache-blast-radius reason, so this is accepted rather than scheduled. Ceiling at `eslint.config.mjs:333-340`. |
| T-07-16 | Registering an Nx inference plugin rotates every task hash. | medium | Legitimate and unavoidable under D-01, which was user-selected with this cost stated. Isolated in `b3fdf6d` so it stays attributable; pre-recorded at `07-EVIDENCE.md:873+` so Phase 9's tripwire is authored to tolerate three legitimate rotation windows. |
| T-07-21 | The evidence file records command output, cache lines and configuration field values. | low | Scanned at audit time: no credential, no token, no bearer value, no private path, no work-domain string. The loopback bearer token is not involved in any measurement recorded there. |

## Transferred risks

| ID | Risk | Transferred to | Transfer documentation verified |
|---|---|---|---|
| T-07-17 | Whether `@nx/eslint` infers `lint` identically on Linux and Windows is UNVERIFIED. The existence gate genuinely runs for this project layout and joins a POSIX-style path onto an absolute Windows root; `options.cwd` is hashed and is the field most likely to diverge. | Phase 8 CORR-03, which treats `lint` as a fourth target in its two-leg measurement. | YES. `07-EVIDENCE.md:498-523` records all six hashed node fields including the resolved `options.cwd`, and explicitly names `metadata` as NOT hashed. `:846-872` states in as many words that the question is UNVERIFIED BY DESIGN and is not reasoned closed here. `07-03-SUMMARY.md:140-144` repeats it. |
| T-07-22 | The D-35 baseline is a Phase 8 input; a wrong or missing entry propagates silently. | Phase 8 CORR-03. | YES. Same records; re-read at plan 07-04 and confirmed byte-for-byte unchanged. |

## Open items

**Blocking (severity >= high): NONE.**

**Non-blocking (below the `high` threshold), tracked here and not counted in `threats_open`:**

| ID | Item | Severity | Note |
|---|---|---|---|
| N-1 | The LINT-06 reason guard enforces the WORD "integration" in surviving prose, not the ARGUMENT. Sites 1-3 argue "moving gains nothing" rather than "cannot move". | low | Deliberate, recorded at `07-REVIEW-FIX.md:298-301` as a decision about how strictly LINT-06 reads. |
| N-2 | The HI-02 strip regex covers `.ts`/`.cts`/`.mts` only. A reason citing `foo.integration.spec.mjs` would still satisfy the clause on a filename token. | low | Theoretical; no such path shape exists in the tree, and the integration runner collects only `{ts,mts,cts}`. |
| N-3 | `07-EVIDENCE.md:790`'s M4 row is stale post-ME-01 (UF-4). | low | Replacement proof exists in `a6af663`; the evidence file was not back-annotated. |
| N-4 | The threat register carries no delta-assessment threat for a lockfile regeneration that changes shipped bytes (UF-2). | low | Structural note for future phases. This instance is fully assessed and clean. |
| N-5 | `07-01-SUMMARY.md` and `07-02-SUMMARY.md` carry no `## Threat Flags` section (UF-1). | low | Process, not code. |

## Verdict

All 22 declared threats verified CLOSED against code or recorded measurement at HEAD. Zero
threats at or above the `high` block threshold are open. The one consumer-facing change in the
phase (undici 6.28.0 in `start-cache-server/index.js`) was independently traced and carries no
reachable exposure. The trust surface is unchanged, verified on all four claimed axes plus the
C1-C18 control sites. Five non-blocking residuals are tracked above.

**Phase 07 is cleared to ship on security grounds.**
