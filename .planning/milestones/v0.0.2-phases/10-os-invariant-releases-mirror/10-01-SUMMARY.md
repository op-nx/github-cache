---
phase: 10-os-invariant-releases-mirror
plan: 01
subsystem: evidence-capture
tags: [xos-02-baseline, retain-05a, shard-census, perishable-measurement, pre-rename]
requires: []
provides:
  - 10-EVIDENCE-PRE-RENAME.md
  - D-25 pre-rename XOS-02 baseline (read-path 200 + Nx-level MISS, fully attributed)
  - RETAIN-05(a) recorded disposition with a shard-attributed measured count
affects:
  - Phase 11 XOS-02 (inherits the baseline and one open PRECONDITION)
  - Phase 10 plan 10-02 (OBS-03 depends on the measured empty-label observation)
  - v0.0.3 (the RETAIN-05a bounding argument is recorded so it is not re-derived)
tech-stack:
  added: []
  patterns:
    - soundness controls established BEFORE the read, because the reader degrades every fault to a MISS
    - COLD-DIRECTORY cold state instead of `nx reset`, to avoid mutating the repo and to sidestep H-5
    - allowlist-inversion email hygiene check on a committed artifact in a public repo
key-files:
  created:
    - .planning/phases/10-os-invariant-releases-mirror/10-EVIDENCE-PRE-RENAME.md
  modified: []
decisions:
  - "D-25's baseline splits in two: the read path is PROVEN LIVE pre-rename (HTTP 200, 410 bytes on 13758457399293023985-windows), while Nx's own end-to-end run MISSED. The MISS is recorded verbatim, never smoothed into the prior record's HIT."
  - "The Nx-level MISS is NOT an open blocker against the read path -- a 200 on a different hash through the same process in the same session refutes that reading. It is recorded instead as an open PRECONDITION: a default-branch push must republish the mirror under the new name before any post-rename local read is measurable."
  - "COLD-DIRECTORY variant used instead of D-25's literal `nx reset`, recorded as a deviation with three reasons: same cold state, repo unmutated, and H-5's ordering hazard removed rather than merely satisfied."
  - "RETAIN-05(a): accepted dead weight with a measured count (50 of 122 in cache-mirror-202607). No code change, no third accept branch."
metrics:
  duration: ~50 min
  completed: 2026-07-29
status: complete
---

# Phase 10 Plan 01: Pre-rename Evidence Capture Summary

Both perishable measurements captured before the phase destroys them: the pre-rename
read path is proven live (HTTP 200) while Nx's own run missed on an unmerged branch whose
hashes were never mirrored, and the `cache-mirror-202607` census is recorded as a decision
with a shard-attributed count of 50 of 122.

## What was built

One artifact, two sections, zero source changes.

`.planning/phases/10-os-invariant-releases-mirror/10-EVIDENCE-PRE-RENAME.md`:

| Section | Content |
|---|---|
| `## D-25 pre-rename XOS-02 baseline` | 12-row soundness-control table, verbatim command transcript, verbatim Nx output, a five-row direct read-path probe matrix, a four-row MISS attribution table, and the disposition Phase 11 inherits |
| `## RETAIN-05(a) shard census and disposition` | the five-family census with the shard tag and release id, the DECISION, the BOUNDING argument, the remaining operational option, and the empty-`label` observation OBS-03 depends on |
| `## Provenance` | commit, branch, tree kind, Node/Nx/Vitest versions, asset naming in effect |

## The measurements

### D-25 -- the headline is a split result, and both halves are measured

| Half | Result |
|---|---|
| Local Windows reader resolves a Windows-CI-produced mirror asset under the current `<hash>-<os>` name | **YES -- HTTP 200, 410 bytes** on `13758457399293023985-windows`, the exact asset the 2026-07-26 prior record hit |
| Nx reports `[remote cache]` for `integration` at branch HEAD | **NO -- `Cache: 0/1 hit (0%)`**, no marker, recorded verbatim |

The MISS is attributed to exactly one cause and three candidates are eliminated by named
control:

| Candidate cause | Status | Eliminating evidence |
|---|---|---|
| No token | ELIMINATED | `gh auth token` RESOLVES (len 40) through `runHelper`'s literal spawn shape |
| No repo identity | ELIMINATED | `git remote get-url origin` RESOLVES |
| Unreachable sidecar / port-token mismatch / wrong backend branch | ELIMINATED | bound URL from the sidecar's own stdout; 401 on wrong bearer; 401 on no bearer; 404 on valid bearer; `isWriteTrusted(process.env).trusted === false`; stderr 0 bytes; and a 200 on a different hash in the same session |
| Nothing published for these hashes | **CONFIRMED, sole cause** | all four cold HEAD hashes ABSENT from every family of the 122-asset shard, while the prior record's hash is present and serves |

The four cold hashes at `06019d4`, each probed: `build` `6003176940154186566` (404),
`integration` `7907925174069363349` (404), `test` `7182296270484722806` (404),
`typecheck` `13957212300839184279` (404). Branch `gsd/v0.0.2-os-invariant-cross-os-sharing`
is unmerged and `publish` runs only on default-branch pushes, so no push has ever mirrored a
hash computed from this tree.

### D-08 -- census, zero delta

Release id `354838660`, shard tag `cache-mirror-202607`, measured 2026-07-29. Identical to
the research take on all six figures, so nothing to reconcile:

| Family | Count | Matched by |
|---|---|---|
| `<hash>.tar.gz` (PoC-era) | **50** | NO filter, before or after RETAIN-04 |
| `<hash>-linux` | 46 | RETAIN-04 legacy branch |
| `<hash>-windows` | 26 | RETAIN-04 legacy branch |
| `<hash>-macos` | 0 | -- |
| anything else | 0 | -- |
| **total** | **122** | of a 1000-asset per-shard cap |

`label` non-empty count: **0 of 122**. This is the fact OBS-03 (plan 10-02) depends on --
the field is genuinely new, not partially populated.

## Deviations from Plan

### Auto-fixed / recorded

**1. [Rule 3 - Method substitution, sanctioned by the plan] COLD-DIRECTORY variant taken instead of `nx reset`**
- **Found during:** Task 1
- **Issue:** D-25's literal wording says `nx reset`; the plan offers the COLD-DIRECTORY variant as the preferred path.
- **Action:** Took the preferred variant and recorded the deviation in the artifact with three reasons. A fourth reason emerged from reading `cache-archive-path.ts`: `CACHE_ARCHIVE_DIR` is the workspace-relative literal `.nx/cache` and is NOT redirected by `NX_CACHE_DIRECTORY`, so not resetting at all REMOVES H-5's ordering constraint rather than merely satisfying it.
- **Commit:** `30d1b9d`

**2. [Rule 1 - Plan text bug] The plan's D-08 bounding-argument sentence misstates the measured total**
- **Found during:** Task 2
- **Issue:** `10-01-PLAN.md` Task 2 says "this shard holds the measured total of 1000". The measured total is **122**, of a 1000-asset cap. CONTEXT.md D-08 states it correctly ("122 of 1000").
- **Action:** Wrote the correct measured figure (122 of a 1000-asset per-shard cap). Recorded here rather than silently substituted. No acceptance criterion depended on the wrong number.
- **Commit:** `ddcea3f`

**3. [Rule 1 - Acceptance-criterion literal] `rg -c 'not code'` is case-sensitive**
- **Found during:** Task 2 verification
- **Issue:** First draft wrote "operational, **NOT code**" for emphasis, so `rg -c 'not code'` returned 0 and the criterion failed.
- **Action:** Rephrased to "explicitly operational and **not code**". Criterion now returns 1.
- **Commit:** `ddcea3f`

**4. [Rule 1 - False completion claim, REVERTED] `requirements mark-complete RETAIN-05` checked off all three parts**
- **Found during:** State updates
- **Issue:** The plan frontmatter declares `requirements: [RETAIN-05]`, so the state step ran `requirements.mark-complete RETAIN-05`. That flipped the REQUIREMENTS.md checkbox to `[x]` for the **whole** requirement. But **RETAIN-05 has three parts and this plan satisfies only (a).** Part (b) (the direct mutual-exclusivity assertion over an adversarial table) and part (c) (the four-consumer `CACHE_KEY_PREFIX` pin) land in the CORR-02 one-commit plan later in this phase.
- **Why it matters:** the milestone audit closes requirements on a 3-source cross-reference (VERIFICATION + SUMMARY + REQUIREMENTS). A premature `[x]` would let (b) and (c) pass unaudited -- a silent coverage hole in exactly the requirement whose whole point is that RETAIN-04 does not cover everything.
- **Action:** Reverted with `git checkout -- .planning/REQUIREMENTS.md` (single-file, targeted -- no blanket reset). RETAIN-05 is left `[ ]`. It should be marked complete by the plan that lands (b) and (c), not by this one.
- **Note for the phase orchestrator:** this is a plan-frontmatter granularity mismatch, not a tooling bug. A multi-part requirement split across plans cannot be marked from the first plan that touches it. Two other requirements in this phase have the same shape (CORR-05's site list, RETAIN-04's same-commit rule) -- check them before their plans run the same step.

**5. [Rule 1 - Self-contradicting ROADMAP row] `roadmap.update-plan-progress` left `10-01` both checked and unchecked**
- **Found during:** State updates
- **Issue:** The verb inserted a bare `- [x] 10-01-PLAN.md` checklist above the pre-existing descriptive list, which still read `- [ ] \`10-01-PLAN.md\` - capture the two perishable ...`. The same plan rendered as both done and not done in one section. It also wrote the progress-table row as `In Progress|  |`, collapsing the cell separator and emptying the date column.
- **Action:** Ticked the descriptive row and restored the table row to `| In Progress | - |`.
- **NOT fixed (out of scope):** the duplicate list *structure* itself. Phase 9's block carries the identical artifact (a stray `- [x] 09-08-PLAN.md` above the full list), so the verb not recognising backticked plan filenames is pre-existing behaviour across this file, not something this plan caused. Expect it to re-insert a bare list on 10-02. Worth one orchestrator decision -- either rename the descriptive entries to bare filenames, or accept the duplication -- but not worth eight ad-hoc repairs.

### Scope widened beyond the plan's literal ask (deliberate, and why)

The plan asks for one cold `integration` run. Three additions were made because the plan's
own step 5 requires stating "which control eliminates which cause", and a single MISS on a
single hash cannot support that:

1. **A second cold run over all four cacheable targets** (`build typecheck test integration`), giving `Cache: 0/4 hit (0%)` and four hashes instead of one.
2. **A direct read-path probe on the prior record's hash** `13758457399293023985`. This is the load-bearing addition: the 200 is what converts "we missed" into "the read path works and the asset is absent", and without it the MISS would have been indistinguishable from a read-path regression.
3. **A cross-check of all four HEAD hashes against the full 122-asset name list**, so the attribution is "absent from every family" rather than the weaker "absent under `-windows`".

## Prohibitions honoured

| Prohibition | Evidence |
|---|---|
| MUST NOT edit `packages/`, `.github/`, `start-cache-server/` | `git status --porcelain packages/ .github/ start-cache-server/` printed nothing, checked before and after both commits |
| MUST NOT record a HIT that was not observed | No Nx-level HIT is claimed at `06019d4`. `Cache: 0/1 hit (0%)` is recorded verbatim. The 200 is recorded as an HTTP read-path result, explicitly distinguished from an Nx `[remote cache]` label |
| MUST NOT paste a `gh api` field carrying a committer email | Counts and names extracted programmatically via `--jq '[.name, (.label // "")]'`; no raw payload written. Allowlist inversion over the artifact returns **zero** email-shaped tokens |
| MUST NOT run `nx reset` under the running sidecar | `nx reset` was never run at all. The COLD-DIRECTORY variant removes the hazard |

## Notes for later phases

- **Phase 11 XOS-02 inherits one open PRECONDITION, not a defect.** A post-rename Nx-level `[remote cache]` HIT is not measurable from a developer machine until a default-branch push republishes the mirror under the OS-free name. Until then any local post-rename read MISSES for the same single cause measured here, and must not be read as an XOS-02 regression. This is already this phase's third Live-CI `human_needed` item.
- **The 2026-07-26 record is now the only Nx-level pre-rename HIT there will ever be.** Phase 11 must cite it for the Nx-consumption half of the comparison; this capture supplies the read-path half fresh.
- **The 401 / 404 / 200 triple plus `isWriteTrusted` false is the calibrated instrument.** Phase 11 should re-run it identically; without it a post-rename MISS is unattributable.
- **Measured, and it narrows D-25's rationale:** the `@actions/cache` version rotation has **no effect on this path**. The Releases reader fetches asset bytes by NAME only; the version-hash layer governs the Actions-cache backend. The prior record's asset still returns the identical 410-byte payload. The fresh capture was still the right call -- that independence was an assumption before this measurement and is now a fact.

## Authentication gates

None. `gh auth token` resolved on the first probe.

## Self-Check: PASSED

| Claim | Check | Result |
|---|---|---|
| `10-EVIDENCE-PRE-RENAME.md` exists | file test | FOUND |
| Commit `30d1b9d` exists | `git log --oneline --all` | FOUND |
| Commit `ddcea3f` exists | `git log --oneline --all` | FOUND |
| No source file changed | `git status --porcelain packages/ .github/ start-cache-server/` | prints nothing |
| Artifact is ASCII-only | non-ASCII char count | 0 |
| No email-shaped token in the artifact | allowlist inversion | 0 matches |
| Every Task 1 acceptance `rg` | 8 patterns | all >= 1 |
| Every Task 2 acceptance `rg` | 9 patterns | all >= 1 |
