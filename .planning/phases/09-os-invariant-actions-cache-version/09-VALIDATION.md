---
phase: 9
slug: os-invariant-actions-cache-version
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `09-RESEARCH.md` `## Validation Architecture` (measured at `565f48f`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x (`@nx/vitest` inferred `test` target; `integration` declared in `packages/github-cache/project.json`) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit) and `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npx nx run @op-nx/github-cache:test --skip-nx-cache` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~3.4 s critical path on a cache miss; 35 spec files / 575 tests (measured at `565f48f`) |

Existing infrastructure covers every unit-observable clause in this phase. No new framework,
no new runner, no new config file.

**Two cwd facts that govern every spec in this phase.** Under `nx test` the merged
configuration carries `options.cwd: "packages/github-cache"` and `vitest.config.mts` sets
`root: __dirname`, so `process.cwd()` is the PROJECT root and `existsSync(cwd/nx.json)` is
FALSE. VER-04's construction guard therefore throws in every spec that builds the real
backend unless a symmetrical `beforeAll`/`afterAll` `process.chdir()` to the workspace root
is in place (measured to work in the vitest pool, `pool=5`, `isWorkerThread=true`). The same
hook also puts the archive in the ROOT `.nx/cache`, which is the gitignored one.

---

## Sampling Rate

- **After every task commit:** `npx nx run @op-nx/github-cache:test --skip-nx-cache`
- **After every plan wave:** `npm run test` plus `npm run typecheck`
- **After every wave touching a `serve()`-reachable file:** `npm run check:action`
  (`build:action` + `git diff --exit-code`), and the diff is **INSPECTED, never assumed
  empty** — Phase 7 saw an 88-line bundle drift caused by a lockfile re-resolution with no
  source edit.
- **Before `/gsd:verify-work`:** full suite green.
- **Max feedback latency:** ~4 s for `test`; the full local battery is the phase gate.

**After PARITY-08 lands, `.github/workflows/ci.yml` is a `test` input** — so every `ci.yml`
edit re-runs `test`. That is the point: without it, DOCS-08's two `ci.yml` corrections and
VER-06's job assertions all serve a stale cached PASS. This repo has shipped that
false-pass class twice already (`governance-email.spec.ts`, and `typecheck`'s
spec-excluding inputs).

---

## Per-Task Verification Map

Requirement-level at plan time (task IDs do not exist until plans are written).
`/gsd:validate-phase` fills the per-task rows and flips the frontmatter post-execution.

| Requirement | Unit-observable clause | Test Type | Automated Command | Non-vacuity control | Status |
|---|---|---|---|---|---|
| VER-01 | the produced string is exactly `.nx/cache/nx-github-cache-abc123.tar` | unit | `nx run @op-nx/github-cache:test` | the literal is hand-authored, never rebuilt from the template, so a rename fails it | ⬜ pending |
| VER-02 | the module names no path/os builder AND imports nothing but the `Hash` type | unit | same | assert the scanner FIRES on a fixture containing the forbidden shape | ⬜ pending |
| VER-03 | per-call argument arrays incl. the flag's positional index (restoreCache 5th, saveCache 4th), per-function call counts, and a source-level count of exactly three reaches | unit | same | clauses 1 and 2 are each other's control — neither passes on the other's failure mode | ⬜ pending |
| VER-04 | the guard THROWS on a wrong cwd and on a diverging `GITHUB_WORKSPACE`; passes on the identity | unit | same | assert the THROW, not just the happy path — a test that still passes with the guard deleted is the failure mode | ⬜ pending |
| VER-05 | the branch is on `=== ''` not the parsed semver; stderr-only output selects zstd; a **non-zero exit still selects zstd**; ENOENT selects gzip | unit | same | the non-zero-exit case IS the control — the only one distinguishing a faithful port from a `runHelper`-shaped one | ⬜ pending |
| VER-06 (leaf half) | `dogfoodBody(hash,'linux')` differs from `dogfoodBody(hash,'windows')` and is deterministic per pair | unit | same | assert the two OS values produce DIFFERENT bytes, else the provenance claim is vacuous at the leaf | ⬜ pending |
| VER-07 | `mkdirSync` runs at construction, before any write, and is recursive | unit | same | remove the directory first, or the assertion passes on Nx's own directory | ⬜ pending |
| PARITY-08 | the `ci.yml` entry survives the MERGED configuration | unit | same | hostile LOCAL `project.json` copy declaring `inputs: ['default']` must redden | ⬜ pending |
| ROBUST-04 | the committed bundle matches a fresh build | command | `npm run check:action` | the diff is inspected, never assumed empty | ⬜ pending |
| OBS-04 | the message names the two causes and the axis, and no longer names the OS one | unit | `nx run @op-nx/github-cache:test` | the three existing `restored as a MISS` assertions (`publish-mirror.spec.ts:426,438,486`) prove the branch is reached; keep that substring | ⬜ pending |
| DOCS-08 | each of the six sites carries its edit | unit | same | `DOCS_08_SITES` keyed on FILE + QUOTED PHRASE, not line number — the edits shift each other's lines in one commit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No framework install, no new
fixtures file. Two accommodations must land WITH the code they serve, not as separate
waves:

- [ ] `actions-cache-backend.spec.ts` + `serve.spec.ts` — symmetrical chdir hook, in the
      SAME commit as VER-04's guard (Hazard A: 15 + 1 real-backend constructions redden
      otherwise). `actions-cache-backend.spec.ts:39` pre-writes at `cacheArchivePath(HASH)`
      BEFORE the `:40` construction, so the hook must also `mkdirSync` — do not make one
      test's setup depend on the side effect of the code under test.
- [ ] `select-backend.spec.ts` — review against the guard (mocks `@actions/cache` but not
      the backend module, so it reaches the real factory on the write-trusted branch).

---

## Manual-Only Verifications

**A spec runs in one process on one OS and CANNOT observe a two-OS property.** That is why
VER-06's load-bearing control is a job, not a test — and why the Nyquist floor for the
cross-OS property is TWO OS legs. One leg samples one OS and cannot detect an
OS-partitioned store at any sampling rate.

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| A `windows-11-arm` runner reads back the entry an `ubuntu-24.04-arm` runner wrote, and the body is LINUX-produced | VER-06 | Two-OS property; and `ci.yml:3-7` filters pushes to `main` while both dogfood jobs are `if: github.event_name == 'push'`, so **it does not run on this branch or on any PR** | After merge to `main`: `dogfood-seed` (ubuntu, SINGLE leg) then `dogfood-verify` (two-leg matrix, `fail-fast: false`). A MISS fails the job. Both legs assert a LINUX-produced body — trivial on ubuntu, the whole point on Windows. Sampling rate: every push to `main`. |
| The one-time all-MISS rotation signal: all-miss on BOTH publish legs with `mirrored == 0` | OBS-04 | Exists on exactly ONE run and cannot be re-sampled — the next push is a normal all-HIT push. Same `main`-only push gate | Read the `publish` job summary on the FIRST `main` push after VER-01. The expected signal must already be committed BEFORE that push (that is what makes "recorded IN ADVANCE" a control rather than paperwork). Caused by the PATH change, not the flag — `enableCrossOsArchive` alone rotates only WINDOWS entries (`cacheUtils.js:166`). |
| The resolved compression method on each real runner image | VER-05 | Runner-image property, push-gated | Read both `publish` legs' job summaries. **Surfaced, never gated** — no branch reads this value. |
| The cwd / `GITHUB_WORKSPACE` identity on a real Windows runner | VER-04 | Runner property | Already MEASURED 2026-07-26 (`PROBE-RESULTS.md` Q2); this phase makes it ENFORCED rather than assumed. Available pre-merge via `integration`'s Windows leg. |

**Two `human_needed` items close this phase: VER-06 and OBS-04.** Do NOT author an
acceptance check that a pre-merge run could satisfy for either — that would be a guard
passing for the wrong reason.

**A green VER-06 is NOT ROBUST-04 evidence.** `dogfood-seed`/`dogfood-verify` use
`./packages/github-cache`, whose `dist/action/index.js` is built from source in-job. They
never execute the committed `start-cache-server/index.js`, which is what four of the five
sidecar sites run. `action-bundle-drift` (`ci.yml:99-116`, no `if:`) is the only control
tying them together.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a named manual-only row above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 accommodations land in the SAME commit as the code they serve
- [ ] No watch-mode flags (`@nx/vitest` is configured `testMode: "watch"` — every
      invocation in this phase must be the non-watch `nx run ...:test` form)
- [ ] Feedback latency < 5 s for the unit gate
- [ ] `nyquist_compliant: true` set in frontmatter (post-execution, by `/gsd:validate-phase`)

**Approval:** pending
