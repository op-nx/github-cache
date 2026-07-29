---
phase: 10
slug: os-invariant-releases-mirror
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-29
---

# Phase 10 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `10-RESEARCH.md` `## Validation Architecture`. Task IDs are filled at plan time;
> `/gsd:validate-phase` audits and closes the remaining gaps after execution.
> ASCII-only by project rule: `[OK]` = harness exists, `[W0]` = Wave 0 gap, `[ ]` = pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `~4.1.0` (effective `4.1.10`, measured in 09-03) |
| **Unit config** | `packages/github-cache/vitest.config.mts` -- includes `**/*.{test,spec}.ts`, EXCLUDES `*.integration.spec.ts` |
| **Integration config** | `packages/github-cache/vitest.integration.config.mts:16` -- `include: ['{src,tests}/**/*.integration.spec.{ts,mts,cts}']`, distinct `cacheDir` |
| **Quick run command** | `npx nx run @op-nx/github-cache:test --skip-nx-cache` |
| **Full suite command** | `npm run test && npm run typecheck && npm run lint && npm run integration` |
| **Bundle drift** | `npm run check:action` -- **MAIN TREE ONLY** (a junctioned worktree `node_modules` made esbuild rewrite 689 lines with no source edit) |
| **Estimated runtime** | ~60 s unit, ~30 s integration |

### CI sampling rate per gate -- this is the load-bearing half

| Gate | Sampling | Consequence |
|------|----------|-------------|
| `test` | **ubuntu-24.04-arm ONLY, single leg** | Any hand-authored `'linux'` literal is sampled at rate **ZERO** (Phase 9 gap G2) |
| `integration` | **two-leg `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`** | The only every-PR two-OS sampler -- why CORR-05 site 4 moves here (D-17) |
| `lint` | every PR/push | LINT-06 `reportUnusedDisableDirectives: 'error'` makes a stale disable a build failure |
| `action-bundle-drift` | every PR and every push (no job-level `if:`) | ROBUST-04's only automated guard; pinned by `dogfood-cross-os.spec.ts:138-151` |
| `publish` / `publish-verify` | **push-to-`main` ONLY** | Unobservable pre-merge at any rate. This is exactly why Phase 9's regression was only findable live |

---

## Sampling Rate

- **After every task commit:** `npx nx run @op-nx/github-cache:test --skip-nx-cache`.
  The `--skip-nx-cache` is **not optional** after a spec-only edit -- Phase 9 measured a
  `Cache: 2/2 hit` stale PASS on exactly that path. Add `npm run lint` on any commit touching a
  disable directive.
- **After every plan wave:** `npm run test && npm run typecheck && npm run lint && npm run integration`.
  The CORR-02 wave additionally runs `npm run check:action` **in the main tree**.
- **Before `/gsd:verify-work`:** full battery green.
- **Max feedback latency:** ~90 s (unit + integration).

---

## Per-Task Verification Map

Task IDs are assigned at plan time. Requirement -> behavior -> command is fixed here; the planner
maps each row onto a task and the executor fills `Status`.

| Req | Behavior | Test Type | Automated Command | Harness | Status |
|-----|----------|-----------|-------------------|---------|--------|
| CORR-02 | `releaseAssetName(hash)` is exactly `nx-cache-<hash>`, pinned as a hand-authored LITERAL | unit | quick run, `release-asset-name` | [OK] re-authored `src/lib/release-asset-name.spec.ts` | [ ] pending |
| CORR-02 | reader and publisher both derive through the ONE helper (no inlined template) | unit | quick run, `releases-backend` + `publish-mirror` | [OK] `releases-backend.spec.ts:128-135`, `publish-mirror.spec.ts:127-136` | [ ] pending |
| CORR-02 | the prefix literal is authored exactly ONCE across the leaf + 3 consumers | unit (source-reading) | quick run, `cache-key` | [OK] extend `cache-key.spec.ts:108-137` `files` map | [ ] pending |
| CORR-02 | committed bundle matches a fresh build | artifact diff | `npm run check:action` (main tree) | [OK] existing script + `action-bundle-drift` job | [ ] pending |
| CORR-05 | zero extant ambient-platform reads in unit specs | unit (source-reading) | quick run, `lint-rules` | [OK] `lint-rules.spec.ts` -- `CORR_05_SITES` empties; ADD `expect(CORR_05_SITES).toEqual([])` (C-2) | [ ] pending |
| CORR-05 | the ban still fires on all six evasion shapes at a unit path, exempt at an integration path | unit | quick run, `lint-rules` | [OK] `EVASION_SHAPES` `:353-503` -- unchanged | [ ] pending |
| CORR-05 | `cachePlatform()`'s default-argument contract, sampled on BOTH OSes | **integration** | `npm run integration` | [W0] NEW `src/lib/release-asset-name.integration.spec.ts` (D-17) | [ ] pending |
| CORR-05 | D-18's replacement: exactly one requested name, equal to the helper's, no platform token | unit | quick run, `releases-backend` | [OK] extend `releases-backend.spec.ts:128-135` | [ ] pending |
| RETAIN-04 | both name families accepted by the cleanup filter | unit | quick run, `release-asset-name` | [OK] extend `release-asset-name.spec.ts:66-103` | [ ] pending |
| RETAIN-04 | a cleanup dry-run over a MIXED shard prunes both families, never a foreign asset | unit (engine + fake) | quick run, `cleanup` | [W0] mixed-shard fixture from the D-08 census | [ ] pending |
| RETAIN-05b | the two branches are mutually exclusive, asserted DIRECTLY over an adversarial table | unit | quick run, `release-asset-name` | [W0] NEW describe -- 26-row table + 3 structural atoms | [ ] pending |
| RETAIN-05c | `CACHE_KEY_PREFIX` pinned + comment-locked as governing FOUR things | unit (source-reading) | quick run, `cache-key` | [OK] extend `cache-key.spec.ts:108-137` | [ ] pending |
| RETAIN-05a | the 50 `.tar.gz` disposition RECORDED with a count | **documentation, not a test** | n/a | [W0] NEW note artifact (shares one file with D-26) | [ ] pending |
| OBS-03 | label is a 4th positional arg on every upload, value `mirrored-by: <os>`, asserted over the WHOLE argument array via `it.each(CACHE_OS_VALUES)` | unit | quick run, `publish-mirror` | [OK] 4 fakes + 4 argument assertions (C-6: 8 edits, not 10) | [ ] pending |
| OBS-03 | `cachePlatform()` called ONCE per run, not per iteration | unit | quick run, `publish-mirror` | [W0] NEW case -- `toHaveBeenCalledOnce()` on a multi-hash fixture; without it the D-10 hoist is unguarded | [ ] pending |
| OBS-03 | the real Octokit adapter forwards `label` | unit | quick run, `action/index` | [OK] extend the adapter test | [ ] pending |
| OBS-03 | no file claims "producing OS" / "whose bytes did the developer get" | unit (source-reading) | quick run, `docs-same-os-claims` | [OK] extend `EDITED_FILES` `:194-207` | [ ] pending |
| OBS-05 | `mirrorSeedHash` yields a distinct, hex, non-all-decimal key per `CACHE_OS_VALUES` member | unit | quick run, `mirror-seed` | [W0] NEW `src/lib/mirror-seed.{ts,spec.ts}` + `CACHE_OS_VALUES.length < 10` pin | [ ] pending |
| OBS-05 | the derived seed survives `parseHash`, `isServerProducedKey`, `releaseAssetName` and BOTH cleanup branches | unit | quick run, `mirror-seed` | [W0] NEW round-trip case | [ ] pending |
| OBS-05 | `read-back.ts` accepts its OWN leg's seed payload and REJECTS every other member's | unit | quick run, `read-back` | [OK] TIGHTEN `read-back.spec.ts:80` `it.each(CACHE_OS_VALUES)` (D-15) | [ ] pending |
| OBS-05 | **the read-back asset's `mirrored-by` label equals the reader's own OS** -- the U-01 control | unit | quick run, `read-back` | [W0] NEW cases; mutation = flip the label | [ ] pending |
| OBS-05 | the `mirror-seed` operation PUTs at the DERIVED hash, not the raw `hash` input | unit | quick run, `action/index` | [W0] NEW case asserting the fetched URL path -- the `url`-reuse trap at `action/index.ts:265`; without this the trap ships silently | [ ] pending |
| OBS-05 | live: each `publish-verify` leg reads back its OWN leg's asset | **live CI, push-to-`main`** | `publish-verify` job | [OK] job exists -- **NOT observable pre-merge**, see Live-CI close | [ ] pending |
| XOS-06 | `max-parallel: 1` retained | unit (ci.yml value) | quick run | [W0] NEW -- `jobBlock('publish')` matches `/max-parallel:\s*1/`. No guard exists today | [ ] pending |
| XOS-06 | the comment records "not a correctness control" + the rejected ordering argument + the U-01 sensitivity | unit (raw-file phrase) | quick run, `docs-same-os-claims` | [W0] NEW `DOCS_08_SITES` rows (raw `read(file)` sees comments; `jobBlock` does not) | [ ] pending |
| XOS-07 | `publish` declares `needs: [build, typecheck, test, integration]` | unit (ci.yml value) | quick run | [W0] NEW -- `jobBlock('publish')` matches all four | [ ] pending |
| XOS-07 | the comment records `!cancelled()` as the mechanism | unit (raw-file phrase) | quick run, `docs-same-os-claims` | [W0] NEW row | [ ] pending |
| XOS-07 | live: one push mirrors that push's full task set | **live CI** | `gh api` asset census after the merge push | [OK] see Live-CI close | [ ] pending |
| TRUST-10 | C1/C2 unchanged | commit-range diff + existing specs | `git diff <base>..HEAD -- src/lib/trust.ts src/lib/sync-gate.ts` (expect empty) + `trust.spec.ts`, `sync-gate.spec.ts` | [OK] | [ ] pending |
| TRUST-10 | C16 Actions-cache side unchanged | function-scoped diff + accept/reject pin | `cache-key.spec.ts:34-74` | [OK] | [ ] pending |
| TRUST-10 | `listCacheEntries` is `ref`-scoped, pinned by spec + comment-locked | unit | quick run, `action/index` | [W0] NEW case -- whole-argument-array assertion on `octokit.paginate` + call count | [ ] pending |
| TRUST-11 / TRUST-12 | recorded in the PLAN.md `<threat_model>` block as INPUT | **plan artifact** | plan-checker reads it | n/a | [ ] pending |
| TRUST-13 | classified BY `gsd-security-auditor` in SECURITY.md | **agent gate** | `/gsd:secure-phase` -> `gsd-security-auditor` | n/a -- **do NOT take the inline short-circuit** | [ ] pending |

*Status legend: `[ ] pending` / `[OK] green` / `[FAIL] red` / `[WARN] flaky`.*

---

## Wave 0 Requirements

New files and new cases required before or alongside implementation:

- [ ] `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` -- CORR-05 site 4 (D-17).
      MEASURED to be hashed by the `integration` target and to run on both OS legs (no stale-cache hazard).
- [ ] `packages/github-cache/src/lib/mirror-seed.ts` + `mirror-seed.spec.ts` -- OBS-05's derivation and
      its `CACHE_OS_VALUES.length < 10` injectivity pin. A NEW file rather than an addition to
      `release-asset-name.ts`, so OBS-05's commit stays outside the bundle-source set.
- [ ] `release-asset-name.spec.ts` -- NEW `describe` for RETAIN-05(b): 3 structural atoms + the
      26-row adversarial disjointness table with the both-branch count pinned to 0.
- [ ] `publish-mirror.spec.ts` -- NEW case: `cachePlatform` called exactly ONCE per run.
- [ ] `read-back.spec.ts` -- NEW cases: the `mirrored-by` label assertion (the U-01 control) and its
      wrong-label rejection.
- [ ] `action/index.spec.ts` -- NEW cases: the `mirror-seed` branch PUTs at the DERIVED hash (the
      `url`-reuse trap), and `listCacheEntries` passes the constructor's `ref` (TRUST-10).
- [ ] `docs-same-os-claims.spec.ts` -- NEW `DOCS_08_SITES` rows for the D-21 sweep: `ci.yml`'s
      `publish-verify` job comment, the shard-growth third correction, the `max-parallel: 1`
      not-a-correctness-control lock, and the `needs:` / `!cancelled()` replacement reason.
- [ ] `cleanup.spec.ts` -- mixed-shard fixture built from the D-08 measured census.
- [ ] A `jobBlock('publish')` guard for the `needs:` and `max-parallel: 1` VALUES. **No such guard
      exists today** -- without it, reverting XOS-07's `needs:` reddens nothing.
- [ ] Recording artifacts (not tests): the D-08 census + bounding argument, D-25's fresh XOS-02
      baseline, and the D-26(a)+(b) SC6 notes.

**Framework install:** none. **New fixture file:** none -- every harness needed already exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each `publish-verify` leg reads back its OWN leg's asset with its own `mirrored-by` label | OBS-05 | `publish` / `publish-verify` are `push`-gated to `main`; no PR run reaches them | After the merge push, read both `publish-verify` legs' logs and confirm each names its own OS as producer; confirm `publish (windows)` reports `mirrored: 1` (its own seed), NOT `0` -- per research correction C-1(ii) |
| One default-branch push mirrors that push's FULL task set | XOS-07 | Requires a real `push` to `main` with all four producer jobs green | `gh api repos/op-nx/github-cache/releases/tags/cache-mirror-<YYYYMM>` -- every task hash from the push present exactly once under `nx-cache-<hash>` |
| The mirror is warm under the new name (Phase 11's precondition) | CORR-02 | Only a default-branch push republishes | Census the shard after the merge; expect `nx-cache-*` names to appear and legacy `<hash>-<os>` names to stop growing |
| Pre-rename XOS-02 baseline | D-25 (owed to Phase 11) | A local cold `nx reset` + sidecar run on a real Windows workstation | Capture BEFORE any rename commit -- the window closes permanently once CORR-02 lands |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify command or a named Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all `[W0]` references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 90 s
- [ ] Every assertion that could be sampled at rate ZERO on ubuntu-only `test` is either moved to
      `integration` or derived from `CACHE_OS_VALUES` rather than the running machine (Phase 9 G2)
- [ ] No absence guard uses a negated matcher inside `toHaveBeenCalledWith` (Phase 9 G3 -- negate the
      QUANTIFIER, not the predicate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
