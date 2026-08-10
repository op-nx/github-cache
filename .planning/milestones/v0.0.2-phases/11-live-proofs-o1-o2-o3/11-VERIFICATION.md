---
phase: 11-live-proofs-o1-o2-o3
verified: 2026-07-30T00:00:00Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 11: Live Proofs -- O1, O2, O3 Verification Report

**Phase Goal:** Three of the four v0.0.2 target outcomes are proven live and recorded with defined
evidence, including the producer attribution that Phase 12 destroys permanently.

**Verified:** 2026-07-30
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | O1: cold Windows box logs `[remote cache]` for `build`, `typecheck`, `test`, per target, named individually | VERIFIED | `11-EVIDENCE.md` quotes all four task lines verbatim (`nx run @op-nx/github-cache:build [remote cache]` etc.), each 1-of-1 against the pre-registered table reproduced from `11-03-PLAN.md`. Corroborated by `run.json` `cacheStatus: remote-cache-hit` for all four |
| 2 | O2: same run HITs `integration` from a Windows-CI-produced artifact, checked as non-regression | VERIFIED | Same run's `integration` line quoted; runner-path fingerprint inside the restored artifact reads `C:/a/github-cache/...` (Windows). Non-regression stated against BOTH halves of the pre-rename baseline with the question each answers named (D-09) |
| 3 | O1 attribution: producer attribution captured at proof time, per hit hash, via Actions-cache entry list + shard asset list with `created_at`/label, cross-referenced against job windows | VERIFIED | `11-EVIDENCE.md` "TEST-08 producer attribution" section: 142 Actions-cache entries and 141 shard assets read with `--paginate`, exact-key matched, cross-referenced against all 22 job legs of run `30471772954`. All 4 hashes attributed (build/typecheck/test -> LINUX via M1+M3, integration -> WINDOWS via M2+M3+M4), each row naming which of the 4 means carried it and that means' limit |
| 4 | Graph premise mechanically asserted (not assumed) that the Windows leg's actual command resolves no build/typecheck/test task, with a non-vacuous negative control | VERIFIED | `capture-hashes.mjs --assert-graph-premise` exists; `11-task-graph-premise.json` records `verdict: "PREMISE OK"`, `integration` set = `[integration]` (no forbidden member), `typecheck` control set = `[build, typecheck]` (2 members, intersects forbidden). Predict-then-observe-then-revert mutation proof recorded in `11-01-SUMMARY.md`. Now WIRED into `ci.yml`'s `hash-parity` job on both legs (WR-05 fix), so the assertion is live rather than inert |
| 5 | O3 part 1: `H_linux != H_win` for `integration`, CITED from CORR-03(b) at the proving commit, not re-derived | VERIFIED | `11-EVIDENCE.md` quotes `hash-parity-compare`'s own verdict line from run `30500255530` (`integration=18442367512424001648/4283357908429349587`), plus `PROBE-RESULTS.md` Q3 as a corroborating prior at a different commit, both cited rather than computed by hand |
| 6 | O3 part 2: Windows `integration` task EXECUTED carrying no remote-cache label, in a run where `H_linux` demonstrably existed before the Windows step started | VERIFIED | `o3-witness` job log quoted: `key=nx-cache-18442367512424001648 created_at=...23:40:37Z started_at=...23:43:01Z delta=144s margin=30s`, `EXISTENCE OK`. Windows leg's own label count is 0 (RECORDED, never gated) with `cacheStatus=cache-miss` |
| 7 | O3 part 3: a positive control in the same job returns 200 through the same sidecar/backend on both legs | VERIFIED | Both legs' positive-control lines quoted, both `-> 200 (wanted 200)` |
| 8 | Soundness probe precedes the measurement, timestamped as such | VERIFIED | Probe completed `2026-07-29T21:44:03Z`; first Nx run started `21:44:28.096Z` (`run.json`), 25s margin, `.nx/cache` confirmed absent at probe time |
| 9 | `ACTIONS_STEP_DEBUG` on for the proving run, unset after, both timestamps recorded | VERIFIED | Set `2026-07-29T23:39:35Z`, deleted `23:57:22Z`, both confirmed by a listing; independently re-confirmed now: repository variable `total_count=0` |
| 10 | `main` restored and verified by SHA equality, not assumption | VERIFIED | `11-EVIDENCE.md` and `11-07-SUMMARY.md` both show `expected == actual == fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`; orchestrator independently confirmed `origin/main` at that SHA and backup ref `refs/heads/backup/main-before-phase11-verify` retained |
| 11 | Every green-job claim paired with a pre-registered count named before the run; every `Cache: n/m hit` line marked NON-DISCRIMINATING IN BOTH DIRECTIONS | VERIFIED | Plans 11-03 and 11-07 both carry a `## Pre-registered counts` section written before execution; `11-EVIDENCE.md` reproduces each verbatim beside the observed value with MET/NOT MET. Every `Cache: n/m hit` occurrence in the file (5 of 5) carries the NON-DISCRIMINATING marking in its immediate vicinity |
| 12 | `mirrored-by` retraction ships with a replacement means, not just a deletion; no surviving claim that it answers the producing OS | VERIFIED | D-14 retraction section states the replacement means (4-means table) and restates the arithmetic (`integration` produced on windows-11-arm, published from ubuntu-24.04-arm 55.16s later). `rg` sweep across shipped source (`packages/github-cache/src`, `ci.yml`) for `mirrored-by` co-occurring with `produc*` returns nothing |

**Score:** 12/12 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `capture-hashes.mjs` `--assert-graph-premise` mode | TEST-08 graph-premise assertion | VERIFIED | Mode present, constants `FORBIDDEN_TARGETS`/`CONTROL_TARGET`, `resolvedTaskIds`/`assertGraphPremise` helpers all present; wired into `ci.yml` `hash-parity` job (both legs) and `package.json` `assert:graph-premise` script (post-review fix WR-05) |
| `read-integration-hash.mjs` | D-17(b) `run.json` reader | VERIFIED | Present at workspace root; 3 guards (command-token match, exactly-one-task, hash-shape check) all confirmed present in the actual file, matching the code-review-fixed version (WR-01/02/03) |
| `.planning/phases/11-live-proofs-o1-o2-o3/11-task-graph-premise.json` | captured TEST-08 evidence | VERIFIED | Exists, `verdict: "PREMISE OK"`, both task-id sets present |
| `.planning/phases/11-live-proofs-o1-o2-o3/11-hashes-warm.json` / `11-hashes-cold.json` | D-06 warm/cold cross-check | VERIFIED | Both files exist on disk with the recorded graph states |
| `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` | D-22 single evidence record | VERIFIED | Exists; contains `## O1`, `## O2`, `## O3` (fully populated, no `PENDING` anywhere), `## O4 ... RESERVED` (neither filled nor deleted) |
| `.github/workflows/ci.yml` `integration` job probe steps | D-16/D-17(a,b,c) symmetric probes | VERIFIED | All 5 named steps present on both matrix legs, no `if: matrix.os` conditional found |
| `.github/workflows/ci.yml` `o3-witness` job | D-17 existence witness | VERIFIED | Job present with `needs: integration`, `if: ${{ !cancelled() }}`, `runs-on: ubuntu-24.04-arm`, `timeout-minutes: 15`, job-level `permissions: {contents: read, actions: read}`; exact-key + ref filter + `// empty` terminator present; `$GITHUB_ENV` injection sink removed (post-review fix CR-01) |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` `o3-witness` describe | presence/shape guard | VERIFIED | 12 `it()` cases present (7 original + 5 added by WR-04 body-assertion fix), all asserting against comment-stripped real shell |
| `packages/github-cache/src/docs-same-os-claims.spec.ts` additive rows | prose-lock guard | VERIFIED | 13 rows keyed on `.github/workflows/ci.yml` (includes the 5 new Phase-11 rows plus the WR-09 occurrence-count fix) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `capture-hashes.mjs --assert-graph-premise` | resolved Nx task graph | `createTaskGraph` -> `Object.keys` | WIRED | Confirmed in source; now also invoked live in `ci.yml` `hash-parity` job (both legs) rather than sitting inert |
| `npm run integration \| tee` | `read-integration-hash.mjs` | immediately-next step, no intervening `nx` call | WIRED | Confirmed step order in `ci.yml`; `read-integration-hash.mjs`'s guard 1 rejects a `run.json` from any other invocation |
| `o3-witness` | `integration-hash-ubuntu-24.04-arm` artifact | `actions/download-artifact@v8` | WIRED | Confirmed; artifact name now cross-checked against the matrix label by a spec clause (WR-11 fix) rather than being a bare literal |
| `o3-witness` | Actions-cache + jobs REST endpoints | `curl`+`jq`, exact `.key`+`.ref` match, `// empty` terminator | WIRED | Confirmed in source; percent-encoding of `$GITHUB_REF` added post-review (IN-05a) |
| `nx reset` (11-02) -> sidecar -> soundness probe -> first Nx run | ordering | timestamps | WIRED | Probe timestamp precedes first `run.json` `run.startTime` by 25s, confirmed in `11-EVIDENCE.md` |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| XOS-01 | 11-02, 11-03, 11-04 | SATISFIED | `- [x]`, row `Complete`; O1 measured and attributed |
| XOS-02 | 11-02, 11-03, 11-04 | SATISFIED | `- [x]`, row `Complete`; O2 measured against both baseline halves |
| XOS-03 | 11-05, 11-06, 11-07 | SATISFIED | `- [x]`, row `Complete`; O3 proven live on push run `30500255530` |
| TEST-08 | 11-01, 11-03, 11-04, 11-05, 11-06, 11-07 | CORRECTLY OPEN | `- [ ]`, row `Pending (O4 evidence row appended in Phase 12)`. TEST-08 spans O1-O4; O4 is explicitly out of Phase 11's scope (ROADMAP assigns XOS-04/05/08 to Phase 12). This is the requirement's own designed shape, not a gap -- confirmed the checkbox agrees with the traceability row (item 9 of the scrutiny list) |
| TEST-09 | 11-05, 11-06, 11-07 | SATISFIED | `- [x]`, row `Complete`; all three parts proven on the same push run |
| TEST-10 | 11-02, 11-03 | SATISFIED | `- [x]`, row `Complete`; reset-first-then-sidecar order, soundness probe, non-discriminating marking all present |
| OBS-02 | 11-03, 11-07 | SATISFIED | `- [x]`, row `Complete`; per-target `[remote cache]` counts recorded in both O1/O2 and O3 |

No orphaned requirements: all 7 IDs (XOS-01, XOS-02, XOS-03, TEST-08, TEST-09, TEST-10, OBS-02) appear in at least one plan's `requirements:` frontmatter and in REQUIREMENTS.md's own traceability table, cross-checked directly against REQUIREMENTS.md text rather than the truncation-prone tooling field.

### Data-Flow / Evidence-Chain Trace

Because this phase's deliverable is evidence rather than application code, the "data flow" check is:
does each recorded number trace to an actual measurement rather than an assertion?

| Claim in `11-EVIDENCE.md` | Traced to | Result |
|---|---|---|
| O1 four `[remote cache]` occurrences | quoted verbatim task lines + `run.json` `cacheStatus` | MEASURED (both primary label-count and structured corroborator agree) |
| Producer attribution (build/typecheck/test -> LINUX, integration -> WINDOWS) | Actions-cache `created_at` + job-window cross-reference + in-artifact runner path, keyed M1-M4 | MEASURED, each cell states which means carried it |
| O3 witness delta 144s | `o3-witness.log`, `created_at` vs `started_at`, echoed in the job log | MEASURED (not a bare pass/fail; the actual delta and margin are both printed) |
| `main` restore | `git rev-parse` SHA comparison, asserted equal | MEASURED |
| `H_linux != H_win` | `hash-parity-compare` job's own verdict line, cited | CITED (not re-derived, matching D-18's mandate) |

No claim found that rests on an unstated assertion where a measurement was required.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Graph-premise mode produces a parseable verdict record | `11-task-graph-premise.json` inspected directly | `verdict: "PREMISE OK"`, both task-id sets as documented | PASS |
| `read-integration-hash.mjs` guards match the code-review-fixed shape | direct source read | whitespace-token match (guard 1), exactly-one assertion (guard 2), hash-shape check (guard 3) all present, matching `11-REVIEW-FIX.md`'s WR-01/02/03 | PASS |
| `o3-witness` job frontmatter matches spec's asserted shape | direct source read of `ci.yml:665-691` | `needs: integration`, `if: ${{ !cancelled() }}`, `runs-on: ubuntu-24.04-arm`, `timeout-minutes: 15`, `permissions: {contents: read, actions: read}` all present | PASS |
| `$GITHUB_ENV` injection sink removed | direct source read of `ci.yml:744-758` | H_linux is read and validated inside its single consuming step; no `$GITHUB_ENV` export of the artifact-controlled value | PASS |
| No lingering `mirrored-by`-as-producer claim in shipped source | `rg` co-occurrence sweep | zero lines match `mirrored-by` AND `produc*` together in `packages/github-cache/src` or `ci.yml` | PASS |
| Full test suite and check:action | orchestrator-provided pre-verification measurement | 848 passed / 0 failed (39 files), `check:action` exit 0, working tree clean | PASS (not re-run per Nyquist guidance -- see note below) |

Note: the full-suite run was not re-executed by this verifier; the orchestrator's pre-verification measurement (taken independently, moments before this agent was spawned) is accepted as current since the working tree is clean and no commits have landed since. Re-running the entire suite a second time would add no new evidence per the "run the full suite at most once" guidance.

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repository, and no plan or SUMMARY references one. This phase's "probes" are the CI-native `o3-witness` job and the local measurement runs, both already exercised live (rehearsal run `30499450423`, proving run `30500255530`, restore run `30501074211`) and both cited above rather than re-run here. Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh` convention in this project).

### Anti-Patterns Found

None. Scanned every file this phase modified (`capture-hashes.mjs`, `read-integration-hash.mjs`, `packages/github-cache/src/dogfood-cross-os.spec.ts`, `packages/github-cache/src/docs-same-os-claims.spec.ts`, `.github/workflows/ci.yml`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and "not yet implemented" / "coming soon" phrasing. Zero hits.

The independent code review (`11-REVIEW.md`, deep, 5 files, 17 findings: 1 critical, 11 warning, 5 info) found real issues -- most notably a `$GITHUB_ENV` injection vector (CR-01) and several silently-passing-guard classes (WR-01 through WR-11). All 17 were fixed (`11-REVIEW-FIX.md`, `status: all_fixed`), each fix independently spot-checked above against the live source rather than trusted from the report's narrative. Suite went from 840 to 848 passing (the +8 are new regression-lock assertions from the fixes), `check:action` stayed exit 0.

### Human Verification Required

None. Every truth resolved to VERIFIED against artifacts on disk, git history, and REQUIREMENTS.md text. The phase's own blocking decision checkpoints (destructive `nx reset`, the hash-rotation sign-off, the temporary `main` push) were all resolved by explicit maintainer selections recorded in the plan SUMMARYs at execution time -- those are historical facts to verify, not open items requiring a fresh human check now.

### Gaps Summary

No gaps. All 7 requirement IDs are accounted for against REQUIREMENTS.md's own text (not the truncation-prone `init.execute-phase` field), with TEST-08 correctly left open as the phase's own designed boundary (it spans O1-O4, and O4 is explicitly Phase 12's). The evidence record consistently distinguishes MEASURED from CITED from ASSERTED claims throughout, the D-14 `mirrored-by` retraction ships a replacement means rather than a bare deletion, every `Cache: n/m hit` occurrence carries its non-discriminating marking, and the O4 section of `11-EVIDENCE.md` is present, reserved, and untouched. The one item worth a forward-looking note (not a gap): `capture-hashes.mjs --assert-graph-premise` is now wired into `ci.yml`'s `hash-parity` job as a read-only graph assertion (post-review WR-05 fix) -- this does not execute any new Windows `build`/`typecheck`/`test` task and therefore does not encroach on O4/Phase 12's boundary; it only makes the TEST-08 premise assertion live rather than inert.

---

_Verified: 2026-07-30_
_Verifier: Claude (gsd-verifier)_
