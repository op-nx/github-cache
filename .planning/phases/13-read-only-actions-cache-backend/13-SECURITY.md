---
phase: 13
slug: read-only-actions-cache-backend
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on (high).
# All 27 threats are CLOSED as of the re-audit at 7968f21. No open threats at any severity.
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
audited_at: 2026-08-02
audited_head: 7968f21
---

# Phase 13 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Register source.** The `<threat_model>` blocks of `13-01-PLAN.md` .. `13-06-PLAN.md`
(`register_authored_at_plan_time: true`). 27 distinct threat IDs -- 22 `mitigate`,
5 `accept`. `T-13-SC` appears verbatim in all six plans and is counted once.

**Method.** Verification is against CODE, not against the execution record. None of the
six SUMMARY files carries a `## Threat Flags` section and none mentions a `T-13-` id
(`git grep -e "Threat Flags" -e "T-13-" -- 13-0*-SUMMARY.md` -> exit 1, zero hits, with a
positive control on `## Accomplishments` hitting all six). There is therefore NO executor
mitigation self-report for this phase, and nothing in this file rests on one.

Two live GitHub Actions runs were queried directly (`gh run view`), not taken from prose.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| workflow author / consumer env -> `selectBackend` | The env bag is untrusted input to a capability decision; the only legitimate direction is narrowing | `CACHE_READ_ONLY` (truthiness only), `GH_TOKEN`/`GITHUB_TOKEN`, `GITHUB_REPOSITORY` |
| `selectBackend` -> constructed backend | RW-vs-RO is decided here and nowhere else (TRUST-05); a caller must not be able to REQUEST write | which factory runs |
| committed bundle -> consumer `uses:` from a git ref | External repos execute `start-cache-server/index.js` directly; `npm ci` never runs for a `uses:` action, so a stale bundle is what consumers actually run | the whole inlined serve() graph |
| `$GITHUB_ENV` (regular step) -> background sidecar process | The only channel that reaches `serve()` before the sidecar starts | the knob, the two `NX_*` vars, the masked bearer token |
| ubuntu producer job -> Windows consumer leg | The cross-OS reuse claim; the gate is the only runtime observation that it still holds | Actions-cache entries |
| planning record -> downstream GSD gates / auditors | A truncated `**Requirements**:` line orphans requirements; ledger silence reads as "assessed and empty" | requirement IDs, control-row decisions |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Status | Evidence |
|-----------|----------|-----------|----------|-------------|--------|----------|
| T-13-SC | Tampering | npm/pip/cargo installs | high | accept | closed | No package manifest touched across the WHOLE phase: `git diff --name-only 82b637d^..HEAD -- package.json package-lock.json packages/github-cache/package.json` -> empty (42 files changed overall). Basis CONFIRMED. |
| T-13-01-R1 | Repudiation | ROADMAP `**Requirements**:` line | medium | mitigate | closed | `ROADMAP.md:579` -- one physical line, all seven IDs (VER-08, VER-09, TRUST-14, XOS-09, TEST-11, DOCS-09, DOCS-10). `ROADMAP.md:354` carries the "KEEP ON ONE LINE" parser lock. |
| T-13-01-R2 | Repudiation | THREAT-MODEL.md ledger silence | low | mitigate | closed | `.planning/THREAT-MODEL.md:117-140` -- the no-control-row decision written INTO the Residual-notes bullet: "**No `C19` was added on purpose**, and that decision is recorded here so the ledger's silence is not read as an omission", with the C1 / C8 / D-08 reasoning. |
| T-13-01-I1 | Information Disclosure | planning-doc edits | low | accept | closed | 13-01's commits (`34577b8`, `4b22cee`, `7b45c38`, `decf56d`, `b4362d8`, `c35ad00`) touch only `.planning/**` and `.gitignore`. No credential, no secret. Basis CONFIRMED. |
| T-13-02-T1 | Tampering | a second `cache.restoreCache` READ call site | high | mitigate | closed | Both factories in ONE file: `actions-cache-backend.ts:88` and `:242`. Ordered-member scan `actions-cache-backend.spec.ts:593-607` asserts `['restoreCache','saveCache','restoreCache']` (identities, never a bare count); single-import clause `:609-619`; VER-09 package-scope importer scan `:687-708` asserting the exact one-element array, with its mutation proof recorded at `:670-677` (throwaway sibling importer -> 1 failed / 30 passed, the two file-scoped clauses staying GREEN). |
| T-13-02-T2 | Tampering | `start-cache-server/index.js` drifting from source | high | mitigate | closed | Bundle regenerated in the SAME commit as the source: `git show --name-only 1172887` lists `actions-cache-backend.ts` + `start-cache-server/index.js`. CI backstop `action-bundle-drift` at `ci.yml:128` running `npm run check:action` at `:138`, with no `if:`. LIVE: that job is GREEN on run `30744366870`, whose `headSha` `gh` confirms is `631a2e7` -- and `git diff --name-only 631a2e7..HEAD -- start-cache-server packages .github docs` is EMPTY, so the green applies verbatim to HEAD. |
| T-13-02-E1 | Elevation of Privilege | a `readOnly` argument re-entering the factory | high | mitigate | closed | Both factories declared with ZERO parameters (`actions-cache-backend.ts:88`, `:242`). `selectBackend.length === 0` pinned at `select-backend.spec.ts:303-310`, plus the behavioral override-shaped-keys clause at `:312-340`. `PutResult = 'stored' \| 'conflict'` at `backend/types.ts:8` -- no `'forbidden'` member anywhere in non-spec source. |
| T-13-02-D1 | Denial of Service | dropping the VER-07 construction-time `mkdirSync` | medium | mitigate | closed | Construction `mkdirSync(CACHE_ARCHIVE_DIR, ...)` at `actions-cache-backend.ts:172`, inherited by the writable factory through the composition CALL at `:244`; per-call `mkdirSync` intact at `:271`. Both halves guarded: `actions-cache-backend.spec.ts:805-819` (removes the dir FIRST, then constructs via the WRITABLE factory) and `:830-849` (deletes AFTER construction, then drives `put`). |
| T-13-02-R1 | Repudiation | a VER-04 message naming a function that did not run | medium | mitigate | closed (guard caveat) | Both VER-04 throws name the factory that actually runs: `actions-cache-backend.ts:141` and `:158` use the `createReadOnlyActionsCacheBackend:` prefix, and the write path reaches them BY CALLING it. See "Mitigations verified as state, not as standing guards" below -- the declared `git grep -c "createActionsCacheBackend:" == 0` is not literally zero and is not wired as a test. |
| T-13-03-E1 | Elevation of Privilege | knob check placed BEFORE an existing narrowing branch | high | mitigate | closed (guard caveat) | Branch order re-measured by this audit at HEAD: first-occurrence offsets in `select-backend.ts` are `resolveGitHubToken(env)` 2961 < `CACHE_READ_ONLY` 3296 < `return createActionsCacheBackend()` 5245 -> "branch order OK", exit 0. The STANDING guard is behavioral: the exhaustive narrowing table at `select-backend.spec.ts:401-448` over five enumerated env shapes, each row PINNING its un-knobbed outcome (`:432`), asserting the implication by negating the QUANTIFIER (`widened(...) === false`, `:439`) rather than by an `if`-guard, plus throw-parity in BOTH directions (`:446`). Paired non-vacuous clause at `:375-391` distinguishes the read-only ACTIONS backend from the memory-degrade one by driving `get()`. |
| T-13-03-E2 | Elevation of Privilege | a second `selectBackend` parameter or a `ServeOptions.readOnly` field | high | mitigate | closed | `selectBackend.length === 0` at `select-backend.spec.ts:303-310`. `src/serve.ts` is NOT in the phase diff, so the `:22-28` comment lock is untouched. The knob is an env-bag KEY read inline at `select-backend.ts:67`. |
| T-13-03-V1 | Input Validation (ASVS V5) | hostile/malformed `CACHE_READ_ONLY` value | low | accept | closed | Basis CONFIRMED: `select-backend.ts:67` is bare truthiness (`if (env.CACHE_READ_ONLY)`); the VALUE is never read, parsed, or interpolated into a command, path or URL -- the name occurs exactly ONCE in the module. Zero-count for the exact-string-parser form holds (`git grep -c -E "=== 'true'\|=== \"true\"" -- select-backend.ts` -> exit 1). Fail-safe direction pinned by `select-backend.spec.ts:455-464` (six typo values still narrow) and `:466-479` (only unset/empty leaves write intact). |
| T-13-03-T1 | Tampering | bundle drift | high | mitigate | closed | Bundle regenerated in the SAME commit `cbf60e6` alongside `select-backend.ts` + `memory-backend.ts`. The bundle carries the branch in the CORRECT last position: `start-cache-server/index.js:68710-68712` (`if (env.CACHE_READ_ONLY) return createReadOnlyActionsCacheBackend();` after the token check, before `return createActionsCacheBackend()`). Same live `action-bundle-drift` green as T-13-02-T2. |
| T-13-03-R1 | Repudiation | a stale "four outcomes" comment surviving the fifth branch | medium | mitigate | closed | `memory-backend.ts` corrected inside `cbf60e6`. Zero-count sweep at HEAD: `git grep -n -i -e "four outcomes" -e "four backend" -- docs packages start-cache-server README.md` -> exit 1 (zero). Positive control on the same paths: "five outcomes" hits `docs/advanced.md:21` and `docs-adoption.spec.ts:171`. |
| T-13-04-V1 | Configuration (ASVS V14) | a new knob on a shipped package | medium | mitigate | closed | `EXPECTED_ENV_KNOBS` carries `'CACHE_READ_ONLY'` at `src/test/consumer-contract.ts:18`, pinned against an explicit inline SORTED LITERAL (never a snapshot) at `public-surface.spec.ts:158-169`, and re-anchored to source by the `KNOB_SOURCE_FILES` `it.each` at `:178-190`. Three documented surfaces, each with its own `it.each` over the same list: `docs/configuration.md:24` + `:83` (guard `docs-adoption.spec.ts:52`), `docs/versioning.md:22` (guard `:82`), `docs/advanced.md:30` (line-scoped guard `:153-157`). |
| T-13-04-R1 | Repudiation | a documented outcome count that no longer matches the selector | medium | mitigate | closed | Prose-count clause `docs-adoption.spec.ts:171` asserts `/`selectBackend` has FIVE outcomes/i` against the sentence a reader reads, deliberately NOT a tally of table rows. MUTATION recorded at `:160-168`: reverting the count reddens THIS clause alone (1 failed \| 42 passed). Companion mutation at `:145-152` for the read-only row. "four outcomes" swept to zero across `docs/` and `packages/`. |
| T-13-04-E1 | Elevation of Privilege | quietly taking rejected option (c) by adding an action input | high | mitigate | closed | `EXPECTED_ACTION_INPUTS = ['port']` at `public-surface.spec.ts:53`, asserted against the REAL `start-cache-server/action.yml` parse at `:150-156`. `action.yml` does not appear in the phase diff. |
| T-13-04-I1 | Information Disclosure | the knob as a new env channel | low | accept | closed | Basis CONFIRMED: every CI site is the inline literal `echo "CACHE_READ_ONLY=1" >> "$GITHUB_ENV"` (`ci.yml:520`, `:630`, `:723`) -- never `${{ secrets.* }}`, and consumed only as truthiness. |
| T-13-05-R1 | Repudiation | a vacuous gate clause matching `exit 1` | high | mitigate | closed | The COMPARISON is matched literally and indent-anchored: `/^ {10}if \[ "\$\{count\}" -lt 1 \]; then$/m` at `dogfood-cross-os.spec.ts:1014`, `:1130`, `:1246`. The pre-existing `ci.yml:527` readiness-poll `exit 1` is named in the `gatedCount` reason string at `:813-817`. Non-vacuity MEASURED (mutations 1 and 3 of 3, recorded `:1000-1010`): deleting the gate step reddens exactly two clauses for that leg; changing `-lt 1` to a never-firing comparison reddens that leg's clause ALONE. LIVE fail-path additionally observed on run `30745558383` -- see the ADDENDUM at `13-EVIDENCE.md:447-517`. |
| T-13-05-T1 | Tampering | a silent revert to a writable sidecar | high | mitigate | closed | Clause A (`readOnlyLeg`) pins the `$GITHUB_ENV` write per leg from disk against a comment-STRIPPED source: `dogfood-cross-os.spec.ts:978-984`, `:1119-1125`, `:1235-1241`, mutation 2 of 3 recorded at `:972-977` (deleting the one echo from `typecheck-windows` reddens that leg alone, its step-mates staying green). Clause B is the comparison above. Revert marker asserted ABSENT per job block at `:1017`, `:1133`, `:1249`. LIVE corroboration: the knob appears in the sidecar's inherited env and `Sent <n> of <n>` occurs ZERO times on all three legs (`13-EVIDENCE.md:319-336`). |
| T-13-05-R2 | Repudiation | a printed log line saying the counts cannot be gated, alongside a gate | medium | mitigate | closed | Verified from the diff of `c818e7a` -- the SAME commit that adds the gate replaces all three `-- RECORDED, never gated` echoes with `-- GATED at a floor of 1` (`ci.yml:599`, `:692`, `:785`). They are CODE and survive the spec's comment strip. |
| T-13-05-D1 | Denial of Service | over-sweeping the marker into the `runner.debug` and `integration` sites | medium | mitigate | closed (2026-08-02, `7968f21`) | Was OPEN at `e6b3268` -- the declared mechanical assertion did not exist. Closed by `7968f21`, re-verified independently here. Three clauses at `dogfood-cross-os.spec.ts:1305-1356`: survivor 1 by its OWN token at `:1306-1322`, survivor 2 by its own at `:1323-1339`, and an EXACT site count (`RECORD_ONLY_SURVIVOR_SITES = 2`, `:1303`) at `:1340-1356`. Both survivor clauses are scoped to `jobBlock('integration')`. See the closure record below for the reproduced mutations. |
| T-13-05-D2 | Denial of Service | dropping `\|\| true` or the sidecar `env: GITHUB_TOKEN` | high | mitigate | closed | `\|\| true` present on all three gate legs -- `ci.yml:598`, `:691`, `:784` -- each with the rationale comment naming it load-bearing at `:591`, `:685`, `:778`. Sidecar `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` present at `ci.yml:527`, `:637`, `:730` and pinned per leg by the `backendToken` clause at `dogfood-cross-os.spec.ts:1023-1025`, `:1139-1141`, `:1255-1257` (a clause deliberately separate from `cacheClient` because the two fail identically-looking). Caveat: only the token half has a standing clause -- see the guard-caveat section. |
| T-13-05-I1 | Information Disclosure | the knob echoed into the run log | low | accept | closed | Basis CONFIRMED: inline `CACHE_READ_ONLY=1`, no secret. The bearer token's `::add-mask::` ordering is untouched -- the knob echo is placed AFTER the token write (`ci.yml:520` follows `:519`), and mask-before-write remains mechanically guarded for EVERY write by `dogfood-cross-os.spec.ts:1317-1347`, whose own message reads "The fix is to move the `echo "::add-mask::${token}"` back above the write, never to relax this clause." |
| T-13-06-R1 | Repudiation | counts written up AFTER the run | high | mitigate | closed | Strongest evidence in the phase, checked with git AND the live API. (a) `631a2e7` introduces `13-EVIDENCE.md` as 203 insertions / 0 deletions. (b) The HEAD file is 517 lines and its first 203 lines are BYTE-IDENTICAL to the `631a2e7` version (prefix diff clean) -- pure append, never back-edited; the file's own "nothing above this line was edited" discipline holds mechanically. (c) `gh run view 30744366870 --json headSha` returns `631a2e7e64f4b5fa74289e672ae013e8efde110c`, conclusion `success` -- the pre-registration commit IS the run's head, so the prediction was provably in the tree the run measured. (d) The record keeps a prediction it got WRONG (`13-EVIDENCE.md:343-370`, job-log raw counts) rather than smoothing it. |
| T-13-06-R2 | Repudiation | a Case-A green written up as reproducing the base-scope read | medium | mitigate | closed | The Case A scope statement appears in BOTH halves: pre-registration `13-EVIDENCE.md:160-176` ("### SCOPE: this is Case A, and it says NOTHING about the base-scope read" ... "A green here proves **NOTHING** about Case B") and observation `:400-411` ("**NOT PROVEN, and not touched:** the base/default-branch scope read. **Case B.** ... This run must not be cited as reproducing it."). The Case-B procedure lives as a separate named ROADMAP item at `ROADMAP.md:651-676`, including the step that verifies Assumption A2 first. |
| T-13-06-T1 | Tampering | relaxing the gate to make a red run green | high | mitigate | closed | Verified behaviorally, not just as an instruction. The floor is still `-lt 1` on all three legs at HEAD. The fail-path proof was run on a THROWAWAY branch: `git merge-base --is-ancestor bafd7be HEAD` -> exit 1 (NOT an ancestor), and `git grep -F "skip-nx-cache" -- .github/workflows/ci.yml` -> exit 1 (the perturbation never landed). The two-branch `::error::` diagnostic an operator is told to route through is present verbatim at `ci.yml:601`, `:694`, `:787`. Cleanup recorded at `13-EVIDENCE.md:507-511`. |

*Status: closed | open | open -- below high threshold (non-blocking).*
*Severity: critical > high > medium > low. Only OPEN threats at or above `block_on: high` count toward `threats_open`.*

---

## Open Findings

**None.** T-13-05-D1 was this section's only entry at the first audit (`e6b3268`); it was
closed by `7968f21` and independently re-verified below. All 27 threats are CLOSED at
every severity -- there are no non-blocking opens left, so `threats_open: 0` is not being
carried by the `block_on: high` filter.

The two items under "Known-Open Observations" further down are NOT findings and were not
touched by this closure: they are deliberate live-CI observations, not register threats.

---

## Closure Record -- T-13-05-D1 (re-audit, 2026-08-02)

The maintainer elected to CLOSE rather than accept. Commit `7968f21`
("test(13): assert the two record-only survivors XOS-09 left ungated (T-13-05-D1)"),
one file changed, +92 lines, `packages/github-cache/src/dogfood-cross-os.spec.ts` only
(`git show --stat 7968f21`). No implementation file, workflow or doc was touched by the
fix, so nothing else in this register moves.

### What landed

`RECORD_ONLY_SURVIVOR_SITES = 2` at `dogfood-cross-os.spec.ts:1303`, then the describe
`ci.yml keeps exactly the two record-only diagnostics XOS-09 did not convert (T-13-05-D1)`
at `:1305-1356`, with three clauses:

| # | Clause | Line | Subject | Needle |
|---|--------|------|---------|--------|
| 1 | `keeps the runner.debug record, which has no floor to be gated against` | `:1306-1322` | `jobBlock('integration')` | `/^ {10}echo "runner\.debug=\$\{RUNNER_DEBUG_OBSERVED:-<unset>\} -- RECORDED, never gated"$/m` |
| 2 | `keeps the integration leg per-OS count, which is still launderable and must NOT be gated` | `:1323-1339` | `jobBlock('integration')` | `/^ {10}echo "remote-cache label occurrences on \$\{LEG_OS\}: \$\{count\} -- RECORDED, never gated"$/m` |
| 3 | `carries the marker on exactly two lines...` | `:1340-1356` | `codeLines` (whole comment-stripped file) | `toHaveLength(RECORD_ONLY_SURVIVOR_SITES)` -- EXACT, not a floor |

### Verified independently, not taken on report

Everything below was measured by this audit against the tree at `7968f21`.

**The suite really passes, uncached.** `npx nx test github-cache --skip-nx-cache` ->
42 files, **978 passed** (975 + 3), `Cache: Skipped (--skip-nx-cache)` -- a real execution,
not an Nx replay. A `--reporter=verbose` re-run names all three new clauses individually
as passing. The claimed count reproduces exactly.

**The guard is genuinely STANDING in CI, not a stale-cache replay.** `nx.json:70` declares
`{workspaceRoot}/.github/workflows/ci.yml` in the `test` target's inputs, so editing
`ci.yml` invalidates this spec's hash and the clauses actually re-run. Without that entry
the whole block would be a guard that replays a PASS computed before the edit -- the
failure mode the spec's own header comment at `:44-47` names. Checked, present.

**The mutations reproduce.** The spec's `codeLines` comment strip (`:49-54`) and `jobBlock`
extractor (`:62-77`) were replicated verbatim in a scratchpad script and applied to
IN-MEMORY mutations of `ci.yml`; the repository was never written (`git status --porcelain`
clean before and after, showing only this file and the pre-existing untracked `.gitkeep`).

| Mutation | Reported | Reproduced | Match |
|---|---|---|---|
| baseline, unmutated | all green | no clause red | yes |
| delete the `runner.debug` echo | clause 1 + clause 3 red, clause 2 GREEN | `clause1-runner.debug`, `clause3-count(got 1)`; clause 2 green | yes |
| delete the per-OS count echo | clause 2 + clause 3 red, clause 1 GREEN | `clause2-LEG_OS`, `clause3-count(got 1)`; clause 1 green | yes |
| smuggle a 3rd ungated record into `build-windows` | clause 3 + the pre-existing `build-windows` `gatedCount` red | `clause3-count(got 3)`, `gatedCount-marker-absent:build-windows` | yes |

The first two mutations are the load-bearing pair: each survivor's clause reddens ALONE
alongside the count, and the OTHER survivor's clause stays green. That is the property the
register demanded ("identified by their own surrounding tokens") and it is now measured
rather than asserted -- neither survivor can cover for the other.

**The scoping holds.** Applying both survivor regexes to each job block: `debugRe` and
`legOsRe` are BOTH false in `build-windows`, `typecheck-windows` and `test-windows`, and
both true in `integration`. No Windows leg can satisfy either clause. Both survivors turn
out to live in the SAME block -- `integration:` spans `ci.yml:823` to the next job key
`o3-witness:` at `:1094` -- which is why one `jobBlock('integration')` subject serves both.

**The exact-count pin is honest.** Comment-stripped marker sites = 2, raw unstripped
sites = 2. The two agree today, exactly as the clause's JSDoc claims to have measured, so
the strip is not hiding a third occurrence in a comment.

**Direction coverage is now complete.** The three pre-existing per-leg
`not.toContain('RECORDED, never gated')` clauses (`:1017`, `:1133`, `:1249`) cover the
UNDER-sweep. Clauses 1 and 2 cover the OVER-sweep. Clause 3's exact pin catches a third
ungated record appearing in a job no per-leg clause reads -- confirmed by the third
mutation, which reddens it from a job block the other clauses do not scope to.

**No collateral.** `git diff --name-only 631a2e7..HEAD -- start-cache-server
packages/github-cache/src/backend packages/github-cache/src/lib
packages/github-cache/src/serve.ts .github docs` is EMPTY. Only a `*.spec.ts` changed, and
specs are not reachable from the esbuild action entry, so no bundle drift is possible and
the live `action-bundle-drift` green on run `30744366870` still applies verbatim at
`7968f21`. T-13-02-T2 and T-13-03-T1 keep their evidence unchanged.

---

## Mitigations verified as STATE, not as standing guards

These three are marked CLOSED because the security property is verifiable at HEAD by
direct measurement (the ASVS L1 standard configured for this phase). Recorded separately
because the register's declared MECHANISM is a one-time acceptance check rather than a
committed test -- at this project's own mutation-measurement standard, "asserted but not
standing" is worth naming. None of these is a blocker.

1. **T-13-03-E1, the branch-position half.** `13-03-SUMMARY.md` coverage item D3 records
   the check as a script run once at execution time ("mechanical first-occurrence check:
   `indexOf(...) < indexOf(...) < indexOf(...)` -> 'branch order OK', exit 0"). No spec
   reads `select-backend.ts` source for ordering. This audit RE-RAN the check at HEAD and
   it passes (2961 < 3296 < 5245). The EoP property itself is separately covered by the
   standing narrowing table, which does catch the dangerous reorderings: moving the knob
   above the fail-closed identity throw breaks throw-parity at `select-backend.spec.ts:446`.
   A move above `isWriteTrusted` would NOT redden the table -- but that move also does not
   widen (read-only -> read-only), so it is a wrong-backend defect rather than an EoP.

2. **T-13-02-R1, the zero-count grep.** The declared criterion is
   `git grep -c "createActionsCacheBackend:" == 0`. At HEAD it is NOT zero: one hit at
   `publish-mirror.spec.ts:26`, which is a `vi.mock` object-literal KEY
   (`createActionsCacheBackend: vi.fn(...)`), not a VER-04 message prefix -- the same
   prose-is-input-to-its-own-criterion format artifact this phase hit three times. Under
   the scoping the source comment itself states ("no non-spec module under `src/` may carry
   it", `actions-cache-backend.ts:136`) the count IS zero. The substantive property holds:
   both throws name `createReadOnlyActionsCacheBackend`, the frame the write path actually
   executes. The specs deliberately assert on message SUBSTANCE and not the prefix
   (`actions-cache-backend.spec.ts:784-786`), so nothing standing pins it.

3. **T-13-05-D2, the `|| true` half.** The register says both `|| true` and the sidecar
   `env: GITHUB_TOKEN` were "asserted unchanged against `HEAD~1`" -- a one-time diff.
   The token half also has a standing per-leg clause (`backendToken`); the `|| true` half
   does not. Verified present at HEAD on all three legs (`ci.yml:598`, `:691`, `:784`).

**T-13-05-D1 is deliberately NOT in this list.** It was never a "state, not a guard" case
-- at `e6b3268` it was a fully OPEN finding, and `7968f21` closed it with three standing,
mutation-measured clauses. It is the only one of the four that now has a real guard. The
three above were not touched by that fix and keep their caveat unchanged.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Basis confirmed by this audit | Accepted By | Date |
|---------|------------|-----------|-------------------------------|-------------|------|
| AR-13-01 | T-13-SC | No package-manager install in this phase; `package.json` / `package-lock.json` untouched, which is load-bearing because a dependency change would rotate task hashes and breach the phase's OUT OF SCOPE line. RESEARCH.md records "Not applicable" for the Package Legitimacy Audit. | **YES.** `git diff --name-only 82b637d^..HEAD -- package.json package-lock.json packages/github-cache/package.json` -> empty, across the ENTIRE phase (42 files changed, none a manifest). Also empty over the prompt's narrower `c35ad00^..HEAD`. | gsd-security-auditor | 2026-08-02 |
| AR-13-02 | T-13-01-I1 | The planning-doc edits carry no credential and no secret; the files are already tracked and public. | **YES.** 13-01's six commits touch only `.planning/**` and `.gitignore`. | gsd-security-auditor | 2026-08-02 |
| AR-13-03 | T-13-03-V1 | `CACHE_READ_ONLY` is consumed only as a truthiness test -- no parsing, no interpolation into a command, path or URL -- and the fail-safe direction is narrowing, so a hostile value can only REDUCE capability. | **YES.** `select-backend.ts:67` is `if (env.CACHE_READ_ONLY)`; the name occurs exactly once in the module and the value is never read. Exact-string-parser form zero-count holds. Typo-narrows and unset/empty-preserves both pinned (`select-backend.spec.ts:455-479`). | gsd-security-auditor | 2026-08-02 |
| AR-13-04 | T-13-04-I1 | The knob carries no secret, is set inline rather than from `secrets.`, and is consumed only as a truthiness test. | **YES.** All three CI sites are the inline literal `CACHE_READ_ONLY=1` (`ci.yml:520`, `:630`, `:723`); no `${{ secrets.* }}` anywhere near it. | gsd-security-auditor | 2026-08-02 |
| AR-13-05 | T-13-05-I1 | `CACHE_READ_ONLY=1` in the run log carries no secret; the bearer token's existing `::add-mask::` ordering is untouched. | **YES.** The knob echo sits AFTER the token write in each pre-set step, so mask-before-write is unchanged, and that ordering remains mechanically guarded for every write by `dogfood-cross-os.spec.ts:1317-1347`. | gsd-security-auditor | 2026-08-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Known-Open Observations -- explicitly NOT closed by this audit

Neither is a threat in the register. Both are deliberate, recorded in `ROADMAP.md`'s Phase
13 `**Live-CI close**` block with stated observation conditions. **A later reader must not
mistake this audit for having closed them.**

1. **Case B -- a PR restoring from the BASE (default-branch) scope. OPEN.**
   Unprovable by this phase's landing commit: it edits `packages/github-cache/src/**/*.ts`,
   `.github/workflows/ci.yml` and two `docs/` files, all declared inputs, so all three task
   hashes rotate and every leg took the intra-run merge-ref path (Case A). Procedure,
   including the step that VERIFIES Assumption A2 before the PR is opened, at
   `ROADMAP.md:651-676`. Second-order effect noted there: once the legs are read-only, a
   Case-B MISS is PERMANENT for that hash on Windows -- a hard red, not a first-run-only red.

2. **RESEARCH assumption A1 -- the PUT `403` log-noise path. OPEN.**
   Unexercised on run `30744366870` because every Windows task HIT (`n/n` restored on all
   three legs), so no task executed and no PUT was attempted -- a fully-restoring run is
   exactly the run that exercises none of it. Observation condition, now stated precisely
   (`13-EVIDENCE.md:372-398`): a PARTIAL miss on the two-task `typecheck-windows` leg prints
   a count of 1, clears the floor, stays GREEN, and attempts exactly one PUT that receives a
   403. What run `30744366870` DOES establish is only the weaker, consistent-with fact: zero
   warnings, zero errors and zero `403`/`forbidden` occurrences on the read-only legs.

Also carried by `13-EVIDENCE.md:420-425` and not a register threat: the floor of 1 is a
per-leg FLOOR, so a partial cross-OS regression on `typecheck-windows` (2 -> 1) clears it
and stays green. Deliberate under D-05; the per-target counts recorded in the evidence file
are the record against which such a drop would be legible.

---

## Unregistered Flags

**None recorded -- and that is itself a process gap, not a clean bill.** No SUMMARY file
in this phase has a `## Threat Flags` section and none mentions a `T-13-` id, so the
executors produced no attack-surface self-report to cross-reference. Every CLOSED verdict
above is therefore grounded in code, git, or a live CI run, never in the execution record.

Per this audit's mandate, no blind scan for NEW threats was performed. The register was
authored at plan time and verified as written.

---

## Security Audit Trail

| Audit Date | Pass | Head | Threats Total | Closed | Open (blocking) | Open (non-blocking) | ASVS | block_on | Run By |
|------------|------|------|---------------|--------|-----------------|---------------------|------|----------|--------|
| 2026-08-02 | initial | `e6b3268` | 27 | 26 | 0 | 1 (T-13-05-D1, medium) | 1 | high | gsd-security-auditor |
| 2026-08-02 | re-audit of the T-13-05-D1 closure | `7968f21` | 27 | 27 | 0 | 0 | 1 | high | gsd-security-auditor |

Branch `gsd/v0.0.2-os-invariant-cross-os-sharing` throughout.

Live runs queried (initial pass): `30744366870` (proving run, `success`, head `631a2e7`)
and `30745558383` (gate fail-path, `failure` by design, head `bafd7be`, branch deleted and
not an ancestor of HEAD).

Re-audit pass: `7968f21` verified by reproducing all three mutations in memory, by an
uncached `npx nx test github-cache --skip-nx-cache` (42 files, 978 passed) with the three
new clauses named individually as passing, and by confirming `nx.json:70` keeps `ci.yml` a
hashed `test` input so the clauses cannot replay a stale PASS. The initial pass's evidence
carries forward unchanged: no bundle-reachable source moved between `631a2e7` and
`7968f21`.

Implementation files were NOT modified by either pass. `13-SECURITY.md` is the only file
this agent has written; `git status --porcelain` was clean of source edits before and after
the mutation reproduction.

---

## Sign-Off

- [x] All 27 threats have a disposition (22 mitigate / 5 accept / 0 transfer)
- [x] All 27 CLOSED -- no open threats at ANY severity, so `threats_open: 0` does not depend on the `block_on: high` filter
- [x] Every `accept` disposition's stated BASIS was independently confirmed, not taken on trust
- [x] Accepted risks documented in the Accepted Risks Log
- [x] The T-13-05-D1 closure was re-verified by reproducing its mutations, not accepted on report
- [x] Case B and assumption A1 remain recorded as known-open, NOT closed, and were untouched by that closure
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02 at `7968f21` -- ships clean. The three residual
"asserted but not standing" caveats (T-13-03-E1, T-13-02-R1, T-13-05-D2) are recorded above
as notes, not findings; none is a blocker and none was introduced by this phase's fix.
