---
phase: 12
phase_name: windows-ci-reuse-o4-consumer-recipe
status: secured
threats_open: 0
threats_total: 21
threats_closed: 21
threats_open_nonblocking: 0
asvs_level: 1
asvs_level_applied: 2
block_on: high
security_enforcement: true
register_authored_at_plan_time: true
audited_tree: c16b8e7
audited_range: cb5a282^..HEAD
branch: gsd/v0.0.2-os-invariant-cross-os-sharing
audited_at: 2026-07-31
auditor: gsd-security-auditor
verdict: SECURED
unregistered_flags: 0
edits_made: []
---

# Phase 12 Security Audit -- Windows CI Reuse, O4, Consumer Recipe

Retroactive verification that every mitigation declared in the six `<threat_model>`
blocks of `12-01-PLAN.md` .. `12-06-PLAN.md` exists in the implemented artifact.
Starting hypothesis for every row: the mitigation is ABSENT until a located match
proves otherwise. No row was credited on a SUMMARY's claim.

**Verdict: SECURED.** 21 of 21 threats CLOSED. Zero open threats at any severity,
so nothing blocks phase advancement under `block_on: high`.

All six SUMMARYs carry a `## Threat Flags` section and all six declare "None". Those
declarations were treated as claims, not evidence -- per the adversarial stance,
accepting them as a complete inventory is a named failure mode. The new attack
surface was bounded independently from `git diff cb5a282^..HEAD` instead (section
`## Unregistered flags`).

Two findings are recorded that are not verdict-changing but are the substantive
security lessons of this phase: the `::add-mask::` ordering ratchet (`## Residual 1`)
and the fact that T-12-08's declared control passed while the artifact it guarded was
still unsafe (`## Threat-model quality`).

---

## Scope

Phase 12's real attack surface, established from the changeset rather than from the
SUMMARY narrative. 50 commits, 42 files.

| Surface | What is new |
|---|---|
| `.github/workflows/ci.yml` | 3 new jobs -- `build-windows`, `typecheck-windows`, `test-windows` -- each `runs-on: windows-11-arm` with a verbatim sidecar block; 2 corrected comment blocks |
| `.github/workflows/windows-regression-detector.yml` | NEW workflow file; `schedule` + `workflow_dispatch`; one `windows-11-arm` job that writes nothing |
| `nx.json` | the `integration` runtime discriminator re-spelled with `--no-warnings`; 2 new `test` input registrations |
| `docs/cross-os.md` | NEW consumer-facing adoption recipe -- the only consumer-facing artifact in the phase |
| `packages/github-cache/src/hash-parity/compare.ts` | comment-only change; the `integration-not-divergent` clause is pre-existing and untouched |
| 4 spec files | 3 new Windows-leg describes, 2 new spec files, 2 registration pins |
| `package.json` / `package-lock.json` | **UNTOUCHED** -- zero commits in range (T-12-SC) |
| `packages/github-cache/src/index.ts` | **UNTOUCHED** -- no new package export |
| `start-cache-server/index.js` | **UNTOUCHED** -- zero commits in range (T-12-17) |

---

## Threat verification -- CLOSED

### The rows at or above the `high` block threshold

| ID | Category | Sev | Disp | Evidence located |
|---|---|---|---|---|
| T-12-04 | Elevation of privilege | critical **if present** | mitigate | **The phase adds EXACTLY six `$GITHUB_ENV` lines and removes ZERO** -- `git diff cb5a282^..HEAD -- .github/workflows/` yields 3x `NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000` (a FIXED LITERAL) and 3x `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}`, with **no `-` line at all**, so no pre-existing write was modified either. The token is minted locally in the same step: `token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"` (`ci.yml:454`, `:504`, `:554`). Hex output cannot contain a newline, so the multi-line `BASH_ENV` payload that made T-11-27 critical is not constructible here. Neither value is record-, artifact- or PR-derived. The detector workflow contains ZERO `GITHUB_ENV` occurrences (`git grep` exit 1, positive-controlled -- the file is 119 tracked lines) |
| T-12-09 | Tampering | high | mitigate | All three declared mechanisms present. (1) `nx.json:106` declares `{ "runtime": "node --no-warnings -p process.platform" }` -- the ONLY `runtime` entry in the workspace, and still the LAST element of the `integration` inputs array (both asserted by executed node probes). (2) Two exact-equality pins: `nx-target-inputs.spec.ts:445` and `:491`, both `toEqual([...])` rather than `toContain`, so a SECOND runtime entry reddens too. (3) `compare.ts:392-401` returns `fail('integration-not-divergent', ...)` when `a.targets.integration.hash === b.targets.integration.hash`, i.e. it fires precisely when the two legs AGREE -- traced to a real gate: `assert-parity.ts:76-82` sets `process.exitCode = 1` on `!verdict.ok`, and `hash-parity-compare` runs it with no `continue-on-error`. The consumer half is present and now count-pinned (see T-12-08). **Residual A1 is OPEN and correctly recorded -- see `## Residual 2`** |
| T-12-20 | Repudiation | high | mitigate | Pre-registration proven from history, not from prose. The counts (`build` 1 / `typecheck` 2 / `test` 1, total 4) were authored in `5733e59`, which `git merge-base --is-ancestor` confirms is an ancestor of BOTH `f5d03b0` (the section fill) and `29484b3` (the observation record). Stronger: `git log -S` on the exact total-count string returns **exactly one commit** -- `5733e59` -- so the pre-registration was never edited after the fact. The verdict is `PENDING -- live-CI, first run of the proving PR` (`11-EVIDENCE.md:1169`), and the record states plainly "No proving run exists, so NO observation is recorded. Not a partial one, not an inferred one" (`:1177-1179`). The ABSENCE is MEASURED with four commands and their results (`:1183-1188`): remote tip `38f9aea`, 55 unpushed commits, zero open PRs, newest run `30518183457` on `main`. `RESERVED -- Phase 12` returns zero matches, and the reservation was CONVERTED rather than deleted (`:19-20`) |
| T-12-SC | Tampering | high | mitigate | ZERO packages installed, proven not asserted. `git log --oneline cb5a282^..HEAD -- package.json package-lock.json packages/github-cache/package.json` returns **0 commits**. Positive-controlled twice: the identical pathspec locates `cffe79a` outside the range, and `git ls-files` confirms all three manifests are tracked, so the zero is absence and not a broken pathspec. The only `package`-matching paths in the changeset are `packages/github-cache/src/*` source files |

### The medium rows

| ID | Category | Sev | Disp | Evidence located |
|---|---|---|---|---|
| T-12-01 | Tampering | medium | accept and RECORD | The recording IS the mitigation, and it exists: `c46b844` appended the Phase 12 re-pricing to `10-SECURITY.md`'s `### Q1 (TRUST-11)` section. BOTH halves are present and separately labelled -- **Leg A** (the `needs:` edge removes the concurrent race, and only the race) and **Leg B** (it does NOT remove the second producer; O1's attribution is permanently FALSE). The write decision is recorded as FORCED with its measurement (`select-backend.ts` x3, `TRUST-05` x3, `D2-02`), the replay nuance is marked `[DERIVED]` rather than measured, and the TRUST-12 exposure delta is stated as *which OS* rather than *whether*. `.planning/THREAT-MODEL.md` is untouched (0 commits in range) and the absence of a C19 row is stated as a decision |
| T-12-02 | Tampering | medium | mitigate | Each leg declares exactly ONE producer as a bare scalar: `git grep -c "^    needs: build$"` = 1, `"^    needs: typecheck$"` = 1, `"^    needs: test$"` = 1 (`ci.yml:437`, `:487`, `:537`). Slicing the three job blocks (434-583) shows exactly three `^    needs:` lines and no list form anywhere in them. The comment block above (`ci.yml:406-417`) states the property the register requires -- the edge removes the RACE, not the second producer -- and explicitly disclaims ordering as a correctness control per XOS-06 |
| T-12-08 | Tampering (by proxy) | medium | mitigate by DESIGN | The order control is present and NON-VACUOUS. `docs/cross-os.md` heads with `## 1. The safe default: declare the discriminator on every cacheable target` (`:18`) and the checklist is `## 2. ... how to EARN a removal` (`:120`). `docs-cross-os.spec.ts:154-168` compares `indexOf` positions -- and critically, both indices are asserted `toBeGreaterThanOrEqual(0)` BEFORE the `toBeLessThan` comparison, so a reworded heading returning `-1` fails loudly instead of satisfying the ordering trivially. **The declared control was necessary but not sufficient, and this is recorded rather than smoothed over -- see `## Threat-model quality`.** CR-01 (BLOCKER) found that section 1's only copy-pasteable snippet demonstrated the OPPOSITE of its own heading while the order clause stayed green. Independently verified FIXED at `2f9f567` by reading the artifact, not the fix report: the snippet now declares the discriminator on three targets with placeholder inputs (`docs/cross-os.md:39-62`) and `:64-72` explicitly warns "Do not copy this repository's end state as a starting point" |
| T-12-10 | Tampering | medium | mitigate | Not vacuous, checked clause by clause. Three describes (`dogfood-cross-os.spec.ts:694`, `:791`, `:863`), 8 `it`s each, **24 `jobBlock('<leg>-windows')` call sites** -- every clause re-extracts the block, so none is file-scoped. Every regex is indent-anchored (`^ {4}runs-on:`, `^ {4}needs:`, `^ {4}timeout-minutes:`, `^ {6}- run:`, `^ {6}- uses:`). The POSITIVE CONTROL is FIRST in each describe (`:710`) and `jobBlock` THROWS on an absent key, so the two `not.toMatch` absence clauses (`:738-739`, `:787`) cannot pass on an empty block. The negated matchers are `expect(string).not.toMatch(...)` -- a correctly negated quantifier over the whole block, not the vacuous `toHaveBeenCalledWith(not.X)` shape this repo has been bitten by. Bonus beyond the declared mitigation: `:770-782` pins the two `$GITHUB_ENV` write lines themselves. **Executed: 63 passed across 11 files** |
| T-12-11 | Tampering | medium | mitigate | The plural needle is a named module constant at `windows-regression-detector.spec.ts:68`: `'Successfully ran targets build, typecheck, test for project'`. The vacuous short needle `'Successfully ran target '` is absent as a standalone pin anywhere in `src/` (exit 1). Non-vacuity is structural, not argued: `codeLines` filters out every `#`-prefixed line (`:53`), so the workflow's own prose comments cannot satisfy the assertion -- and the workflow's comment block deliberately does not spell the needle verbatim either. The existence positive control is the FIRST `it` (`:79`), before the two absence clauses (`:182`, `:193`). **Executed: 8/8 pass** |
| T-12-12 | Tampering | medium | mitigate | The same-commit property is proven from history, which is the only place it CAN be proven -- the final tree cannot show it. `git log -S "{workspaceRoot}/.github/workflows/windows-regression-detector.yml" -- nx.json` and `git log --diff-filter=A -- packages/github-cache/src/windows-regression-detector.spec.ts` both return the SAME single commit, `91dbdc1`, whose stat lists exactly `nx.json` (+1), `nx-target-inputs.spec.ts` (+27) and the new guard (+179). Explicit path, not a glob: the entry sits at `test.inputs[20]`, adjacent to `ci.yml` at `[19]` |
| T-12-13 | Tampering | medium | mitigate | Exit 0 is genuinely not the gate. `windows-regression-detector.yml:117-119` is `set -euo pipefail`, then the `run-many` piped through `tee detector.log`, then `grep -q 'Successfully ran targets build, typecheck, test for project' detector.log` as the LAST command -- so a failed `grep` (exit 1) terminates the step under `set -e`, and `pipefail` propagates an `nx` failure through `tee`. The comment at `:81-93` records the source trace (`formatting-utils.js:37`) and the `-t` argument-order trade |
| T-12-15 | Tampering | medium | mitigate | `--no-warnings` is present in the live config (`nx.json:106`, verified by executed probe, not by grep alone). The residual is documented rather than overstated: `08-ROOT-CAUSE.md:1613-1619` records that node's warning text carries the process PID so a warning would vary the hash on EVERY invocation (permanent 100% MISS, not a one-time rotation), and that the surviving startup-error channel "fails loud" -- empty stdout, non-zero exit -- instead of silently re-partitioning the cache |
| T-12-16 | Repudiation | medium | mitigate | Superseded IN PLACE, attached to the constraint rather than filed elsewhere. The bounding-constraint row is `08-ROOT-CAUSE.md:1589` with its prose at `:1591-1594`; the supersession follows immediately at `:1596` under its own heading. All six required components are present AND substantive, not token-dropped: (1) scope of the change `:1603-1604`; (2) the `hash_runtime.rs:33-35` citation `:1606-1611`; (3) the PID/permanent-MISS bounded failure mode `:1613-1619`; (4) the measurement -- stderr empty on both legs, the four-cell shell-by-flag matrix, `cmd /C` vs `sh -c`, the 100-bytes-to-0 `emitWarning` control `:1621-1629`; (5) the phase-scoped reading with the cost of the alternative `:1631-1639`; (6) the pins moved with it `:1641-1645`. The old argument is kept visible as SUPERSEDED, not deleted |
| T-12-17 | Tampering | medium | mitigate | Closed from both directions. **The class of edit does not reach the bundle:** all four of `compare.ts`'s distinctive symbols (`integration-not-divergent`, `DIVERGENT_TARGET`, `compareHashParity`, `EXPECTED_TARGETS`) are ABSENT from `start-cache-server/index.js`, positive-controlled by `releaseAssetName` appearing twice in the same file. Consistently, the bundle has ZERO commits in the phase range while `git log` confirms it is tracked with real history (last touched `77f675c`, Phase 10) -- so the absence is "no drift", not "drift missed". **The standing gate survives:** `action-bundle-drift` (`ci.yml:99-108`) carries NO `if:`, so it is PR-eligible, and runs `npm run check:action` plus `npm run typecheck:action` |
| T-12-18 | Repudiation | medium | mitigate | The stale-PASS window is closed, proven from history. `git log -S "{workspaceRoot}/docs/cross-os.md" -- nx.json` and `git log --diff-filter=A -- docs/cross-os.md` both return `6c0c2d1`, whose stat is exactly `README.md`, `docs/advanced.md`, `docs/cross-os.md` and `nx.json` -- doc and registration in ONE commit. The guard spec landed one commit earlier (`8abe25c`), which is the TDD RED gate and creates no window: a RED guard cannot replay a stale PASS. The registration is effective on its own commit because `{workspaceRoot}/nx.json` is itself `test.inputs[5]`; the new entry sits at `[12]`, adjacent to `docs/configuration.md` at `[11]`. The dependency is stated in the guard's own docstring (`docs-cross-os.spec.ts:28-33`) citing PARITY-08 by name |

### The low rows

| ID | Category | Sev | Disp | Evidence located |
|---|---|---|---|---|
| T-12-03 | Information disclosure | low | accept / mitigate | Both halves. The TRUST-12 append is present in `10-SECURITY.md` (the exposure delta stated as *which OS's* output, with `publish` push-gated, `isSyncTrusted` a separate allowlist (C2) and the mirror filter admitting only server-produced keys (C16)). The quoting discipline holds: a sweep for `Bearer <value>`, a literal `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<hex>`, `ghp_`/`gho_`/`ghs_`/`github_pat_`, `X-Amz-` and `Signature=` across the whole phase-12 planning directory AND `11-EVIDENCE.md` returns **exit 1, a genuine no-match** -- positive-controlled by the identical sweep locating those patterns in five other files in the tree |
| T-12-05 | Information disclosure | low | mitigate | **Verified independently in all THREE legs, because one reordered copy would be a real leak.** `echo "::add-mask::${token}"` sits strictly before the token's `$GITHUB_ENV` write in every case: `ci.yml` 455/456 (`build-windows`), 505/506 (`typecheck-windows`), 555/556 (`test-windows`). The token is minted at 454/504/554, one line before its mask, so no window exists in which the value is live but unregistered. **The ordering is correct today but remains unguarded, and this phase widened the exposure -- see `## Residual 1`** |
| T-12-06 | Elevation of privilege | low | accept | The acceptance's PREMISE was verified rather than assumed -- this is the check Phase 11's T-11-23 failed. `git diff --stat cb5a282^..HEAD` over `lib/trust.ts`, `lib/sync-gate.ts` and `lib/select-backend.ts` is EMPTY (positive-controlled: `git ls-files` confirms all three are tracked), so C1 and C2 are byte-unchanged. `ci.yml`'s `on:` trigger block and workflow-level `permissions:` block are byte-untouched across the phase -- an anchored diff filter for `on:`/`push:`/`pull_request:`/`schedule:`/`workflow_dispatch:`/`permissions:`/`branches:` returns exit 1. At HEAD the triggers remain `push: branches: [main]` + `pull_request:` with `permissions: contents: read`. So the three legs widen the NUMBER of jobs on the existing path, not the path -- exactly as the acceptance claims |
| T-12-07 | Elevation of privilege | low | mitigate | Every clause holds in the file. Triggers are `schedule:` (`:34-35`, cron `'23 4 * * *'`, off the top of the hour and distinct from `cleanup.yml`'s `'17 3 * * *'`) plus `workflow_dispatch:` (`:43`); no `push:`, no `pull_request:`. `permissions: contents: read` at workflow level (`:49-50`) with NO `actions:` scope. No `concurrency:` block, and its absence is comment-locked with the reason (`:52-55`). `workflow_dispatch`'s comment states its real justification and explicitly disclaims the pre-merge-proof claim (`:36-42`) |
| T-12-14 | Denial of service | low | mitigate | The detector participates in no cache tier. `start-cache-server` and `NX_SELF_HOSTED_REMOTE_CACHE` are BOTH absent from the workflow -- positive-controlled by the identical needles returning 15 and 42 respectively in `ci.yml`, so the zeros are absence and not a broken search. `--skip-nx-cache` is present on the one substantive invocation (`:118`). No sidecar, no remote-cache client variable, therefore no remote tier and zero new cache entries |
| T-12-19 | Information disclosure | low | mitigate | Detection by ALLOWLIST INVERSION; no forbidden value appears in this document or was used as a needle. **Zero email-shaped tokens across all 42 phase-12-changed files**, swept with `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`. The zero is positive-controlled: the identical pattern locates the approved public gmail in archived `.planning/milestones/` artifacts and other address forms elsewhere in the tree. Commit identity is clean too -- `%ae` and `%ce` across all 50 commits in range reduce to a SINGLE distinct value, the approved public gmail. `docs/cross-os.md`, the one consumer-facing artifact, carries no contact address of any kind |

---

## Accepted Risks Log

Four rows carry disposition `accept` (T-12-01 as "accept and RECORD"). Each is
recorded here so the acceptance is a register entry rather than an omission, and
each acceptance's PREMISE was verified in code rather than taken on trust.

| Risk ID | Threat Ref | Sev | Accepted risk | Why the acceptance holds | Accepted By | Date |
|---|---|---|---|---|---|---|
| R-12-01 | T-12-01 | medium | From `f5dd429` a `windows-11-arm` job holds a write-trusted Actions-cache backend for `build`, `typecheck` and `test`, so a SECOND PRODUCER exists on an existing write path and O1's "any such hash is Linux-produced" attribution is permanently FALSE. | Not resolved -- MOVED and RECORDED, which is what the disposition asks for. The `needs:` edge removes the concurrent race within a run; cross-run the winner is whoever ran first and no requirement DEPENDS on the winner (XOS-06). It is a determinism/attribution property, not an authorization one: both legs are the same already-trusted principal on the same ref, and C1's write-trust allowlist is OS-blind and byte-unchanged. Recorded in `10-SECURITY.md` Q1 with both halves and the `[DERIVED]` capability sharpening. | gsd-security-auditor | 2026-07-31 |
| R-12-02 | T-12-03 | low | Windows-produced captured terminal output for these three targets can now reach the anonymously-readable Releases mirror. | The delta is *which OS's* output, never *whether* output crosses -- that was settled by VER-01/VER-03 in Phase 9. Containment is unchanged and none of it is OS-derived: `publish` is push-gated, `isSyncTrusted` is a separate allowlist (C2), and the mirror filter admits only server-produced keys (C16). All three controls verified byte-unchanged this phase. | gsd-security-auditor | 2026-07-31 |
| R-12-03 | T-12-06 | low | A fork PR now reaches three MORE jobs that mint a loopback token and hold a write-trusted Actions-cache backend. | Unchanged from C1's recorded posture, and verified rather than inherited: `lib/trust.ts`, `lib/sync-gate.ts` and `lib/select-backend.ts` are byte-unchanged, and `ci.yml`'s `on:` and `permissions:` blocks are byte-untouched. The load-bearing controls are GitHub's server-side guard plus Actions-cache SCOPE isolation (a PR run writes into `refs/pull/N/merge`, unreadable from the base branch). The legs widen the NUMBER of jobs on that path, not the path. | gsd-security-auditor | 2026-07-31 |
| R-12-04 | T-12-06 (12-06 restatement) | low | The proving run itself is a `pull_request` event holding read-write cache permission. | `pull_request` keeps read-write caching per the 2026-06-26 changelog; the read-only rule fires only when an untrusted trigger ALSO runs at the shared default-branch scope. This repo has MEASURED its scope: both entries of a PR run were written under `refs/pull/11/merge`. The proof cannot poison `main`'s scope even in principle. | gsd-security-auditor | 2026-07-31 |

---

## Threat-model quality: T-12-08's control was necessary but not sufficient

Recorded because it is the substantive lesson of this phase's security posture, and
because it is the SAME shape Phase 11's audit recorded for T-11-27.

T-12-08 declares its mitigation as "mitigate by DESIGN -- D-11's section ORDER *is*
the control". That control was implemented correctly, guarded non-vacuously, and
GREEN -- and the document was still unsafe to copy. `docs/cross-os.md` section 1's
heading said "declare the discriminator on every cacheable target" while the only
copy-pasteable snippet under it declared the discriminator on exactly ONE target:
`integration`, this repository's EARNED EXCEPTION. A consumer doing the one thing the
document exists for would have pasted the wrong-result configuration.

The order clause could not have caught it. Order is a property of the section
sequence; the defect was in the payload of the correct section. **The mechanism that
caught it was `/gsd:code-review` (CR-01, BLOCKER), not the threat model** -- exactly
as T-11-27 was caught by review and not by the register.

What makes this closable rather than open is that the fix is MECHANIZED, not just
prose. `docs-cross-os.spec.ts` now pins an EXACT occurrence count:

- `RENDERED_DISCRIMINATOR_SITES = 4`, asserted with `.toBe(4)`, not a `>= 1` floor.
- A count of 2 means the snippet collapsed back to one target -- the CR-01 regression.
- The comment records that a `>= 1` floor is "exactly as HALF-LOCKING as the
  `toContain` it replaced", because it would let the VERIFICATION FENCE be deleted --
  and the verification fence is the half that closes T-12-09 on the adopter's side.
- A fifth occurrence fails too, deliberately, so the count cannot drift upward
  unnoticed.

That is a stronger control than either T-12-08 or T-12-09 declared. The register
row is closed on the FIXED artifact, read directly rather than taken from
`12-REVIEW-FIX.md`.

The shape to watch for in future registers: **a control that guards the STRUCTURE of
an artifact does not guard its CONTENT.** T-12-08 named the order; nothing in the
register crossed from the order to what the ordered section actually said.

---

## Residual 1 -- the `::add-mask::` ordering is unguarded, and this phase tripled it

Not a register row and not a `threats_open` contributor. Recorded because it is a
ratchet rather than a static gap.

Phase 11's audit logged this as unregistered flag 4 -- "No guard on the `ci.yml`
`::add-mask::` ORDERING" -- and correctly called it PRE-EXISTING surface, not Phase
11's. **That characterisation no longer holds.** Phase 12 added three more copies of
the sidecar preset block, taking the file from 5 masked-token sites to 8. Three of
the eight are this phase's.

The state of the guards, verified rather than assumed:

- The ordering is CORRECT in all eight blocks today. Verified individually for the
  three new ones (`ci.yml` 455/456, 505/506, 555/556).
- The only `::add-mask::` assertion anywhere in `packages/github-cache/src/` is
  `docs-adoption.spec.ts:111`, which pins the DOCUMENTED SNIPPET in an adoption doc.
  Nothing asserts it for `ci.yml` itself.
- The new `cacheClient` clause added by this phase
  (`dogfood-cross-os.spec.ts:770-782`) pins the two `$GITHUB_ENV` WRITE lines per leg
  -- but not the mask line that must precede them. So a future editor could delete or
  move the `::add-mask::` line and all 24 new Windows-leg clauses would stay green.

Why LOW and why it is not opened as a threat: D-03's verbatim-copy discipline is what
preserved the ordering across three copies and it demonstrably worked; the exposure
is a masked-token window rather than a demonstrated leak; and the value is a
per-process loopback bearer, not a repository credential. But the protection is now
carried entirely by copy discipline across eight sites, which is one careless
"cleanup" away from a real leak on a PUBLIC repository.

Recommended owner: whichever phase next touches a sidecar block. The cheapest shape
is one clause per leg asserting the mask's index is less than the token write's index
within `jobBlock(<leg>)` -- the same index-comparison idiom `docs-cross-os.spec.ts`
already uses for the section order, including its `>= 0` pre-guards.

**No implementation file was edited to close this.** This audit's brief makes
implementation files read-only.

---

## Residual 2 -- RESEARCH assumption A1 is OPEN, and is correctly recorded as open

T-12-09's first mechanism (`--no-warnings` closing node's warning channel) was
measured only on `win32/arm64`. A1 is the assumption that it behaves identically on
`linux/arm64`.

**A1 is honestly recorded as OPEN in two independent places**, and this audit
confirms neither overstates it:

- `12-VERIFICATION.md:20` -- "The only artifact checked so far (run `30500255530`)
  recorded the PRE-hardening command ... A1 remains explicitly OPEN, not closed by
  inference".
- `12-06-SUMMARY.md:190-195` -- records that closing A1 from the available artifact
  "would be exactly the inference" the plan forbids.

One nuance worth stating, because a reader could otherwise mistake it for a
contradiction: `08-ROOT-CAUSE.md:1621-1622` records stderr EMPTY on both CI legs.
That measurement is of the PRE-hardening command (`node -p process.platform`). A1 is
specifically about the POST-hardening spelling on linux. The two do not conflict.

**Why this does not open T-12-09.** The mitigation is PRESENT and correctly placed,
which is what `asvs_level: 1` verifies; A1 concerns the measured EFFICACY of one
mechanism on one leg. The residual is also partly backstopped: if the discriminator
ever COLLAPSED to one value, `compare.ts`'s `integration-not-divergent` clause fails
the `hash-parity-compare` job. The backstop is directional and that limit is stated
here rather than left implied -- it catches collapse, not per-invocation VARIANCE. A
linux warning would produce varying-but-still-different hashes, so it would present
as a permanent MISS (T-12-15's failure mode, `medium`) rather than as a wrong result.
Closing it costs nothing: the next CI run on this tree records the new command's
stdout and stderr per OS into `hash-parity-<os>.json` with no new instrument, because
`readDiscriminatorCommand` reads the command out of `nx.json` rather than re-spelling
it.

Carried as human-verify item 3 in `12-06-PLAN.md`, which is the right home for it.

---

## Unregistered flags

**None.**

All six SUMMARYs carry a `## Threat Flags` section -- a real improvement on Phase 11,
where four of seven omitted it entirely and the audit had to compensate by scoping
from the git diff. All six declare "None" or "None new".

Those declarations were NOT accepted as a complete inventory. The new surface was
bounded independently:

- **New workflow file:** one, `windows-regression-detector.yml`. Registered as
  T-12-07 / T-12-13 / T-12-14.
- **New workflow jobs:** three, all in `ci.yml`. Registered as T-12-01 / T-12-02 /
  T-12-04 / T-12-05 / T-12-06.
- **New event trigger on `ci.yml`:** none. The `on:` block is byte-untouched
  (anchored diff filter, exit 1).
- **New `permissions` change:** none. Byte-untouched in `ci.yml`; the detector
  declares `contents: read` only.
- **New credential path:** none. The three legs copy the existing preset block
  verbatim; `select-backend.ts` is byte-unchanged.
- **New network egress:** none beyond `actions/checkout` + `npm ci` in the detector,
  and the pre-existing loopback sidecar in the three legs.
- **New dependency surface:** none. Empty diff over both manifests and the lockfile,
  positive-controlled.
- **New package export:** none. `packages/github-cache/src/index.ts` is byte-unchanged
  (empty diff, positive-controlled by `git ls-files`), so the barrel is untouched and
  no consumer-facing API surface was added.
- **New consumer-facing artifact:** one, `docs/cross-os.md`. Registered as T-12-08 /
  T-12-09 / T-12-19.

The two observations in `## Residual 1` and `## Threat-model quality` both map onto
existing register rows (T-12-05 and T-12-08 respectively), so neither is an
unregistered flag.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open (blocking) | Open (non-blocking) | Run By |
|------------|---------------|--------|-----------------|---------------------|--------|
| 2026-07-31 | 21 | 21 | 0 | 0 | gsd-security-auditor |

---

## Method notes

- **`asvs_level` is configured at 1** (presence-level). Verification was performed at
  L2 -- boundary placement checked for every mitigation, with an end-to-end trace on
  the `$GITHUB_ENV` sink, the discriminator's path from `nx.json` through `compare.ts`
  to a non-zero process exit, and the doc's path from `nx.json` to the rendered
  snippet. That depth is warranted because the phase adds a second write-trusted
  producer and ships this milestone's only consumer-facing artifact.
- **Every negative search in this report was run with a positive control first.** The
  load-bearing cases are the email sweep (zero across 42 files; the same pattern
  locates the approved gmail elsewhere in the tree), the manifest diff (zero commits;
  the same pathspec locates `cffe79a` outside the range), the detector's cache-tier
  absence (zero; the same needles return 15 and 42 in `ci.yml`), and the bundle
  reachability check (four symbols absent; `releaseAssetName` present twice).
- **Two mitigations were verified from git history, not from the final tree**, because
  a same-commit property is not observable in a tree: T-12-12 (`91dbdc1`) and T-12-18
  (`6c0c2d1`), each confirmed with `git log -S` plus `--diff-filter=A` resolving to the
  same commit and `--stat` confirming the file set.
- **T-12-20's pre-registration was proven immutable**, not merely early:
  `git merge-base --is-ancestor` for ordering, plus `git log -S` on the exact
  total-count string returning exactly one commit, which rules out a post-hoc edit.
- **Nine rows were additionally confirmed by RUNNING rather than reading.** The guards
  for T-12-08, T-12-09, T-12-10, T-12-11, T-12-12, T-12-13, T-12-18 and the two
  registration pins were executed: `-t "windows"` gives 63 passed across 11 files, and
  `-t "cross-os|detector|discriminator|hash-parity"` gives 31 passed across 7 files
  including `windows-regression-detector.spec.ts` 8/8 and `docs-cross-os.spec.ts` 9/9.
  A present-but-skipped guard would have shown here.
- **Credential detection was by ALLOWLIST INVERSION.** No forbidden value appears
  anywhere in this document and none was used as a search needle.
- **No implementation file was modified by this audit.** The only file written is this
  one.

## `threats_open` computation

`block_on: high`; severity order critical > high > medium > low.

- OPEN threats: **none**, at any severity.
- The fail-closed rule for missing or unparseable severity does not apply: all 21
  rows carry an explicit severity in their authoring plan's register.
- The two residuals recorded above are NOT register rows and are not counted. Residual
  1 is a hardening recommendation on a control that is correct today; Residual 2 is a
  measurement item the phase itself carries as a human-verify entry.

**`threats_open: 0`.** Phase 12 is clear to advance.

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: secured` set in frontmatter

**Approval:** verified 2026-07-31
