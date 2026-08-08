---
phase: 9
slug: os-invariant-actions-cache-version
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
audited: 2026-07-29
audited_at_commit: 84a470a9d676be2a53eade7acf40f8a185657eae
baseline_at_audit: 675 tests / 38 spec files; all nine battery commands exit 0
---

# Phase 9 -- Validation Strategy

> Per-phase validation contract. Authored at plan time from `09-RESEARCH.md`
> `## Validation Architecture` (measured at `565f48f`); RECONCILED against what actually
> shipped by the retroactive Nyquist audit on 2026-07-29.

**What the audit changed, so a reader is not misled by the plan-time text.** The measured
baseline, the per-requirement statuses, and -- most importantly -- the `## Manual-Only
Verifications` section have all moved. That last section was stale in the FAVOURABLE
direction: it said two `human_needed` items closed the phase, when a maintainer-authorised
temporary push to `main` had since SAMPLED both and a third item had appeared. The
plan-time text is superseded, not deleted, wherever the distinction matters.

---

## Frontmatter verdicts, and why each one is set that way

Set from this audit's own analysis, not flipped on the strength of the phase reporting
itself complete.

**`nyquist_compliant: true`.** All eleven requirement IDs carry a standing automated check
that runs at a rate high enough to detect a change in the property it names, and each
check's non-vacuity is itself asserted (the table below cites the specific control per
row). Two gaps found by this audit were genuine and are CLOSED by tests generated here
(`## Gaps found and closed`); one existing guard was hardened after a mutation proved its
assertion form was satisfiable without the property holding. The residuals that remain are
NOT sampling gaps -- they are two push-gated live confirmations of properties already
sampled by fixture at every-commit rate, plus one observable that is physically
unrepeatable and is recorded as such (`## Residuals`). Compliance is claimed for the
sampling of the eleven requirements, and explicitly NOT for "nothing is left open".

**`wave_0_complete: true`.** Both plan-time accommodations landed with the code they serve,
and one landed further than the draft asked. `enterWorkspaceRootCwd` (extracted to
`packages/github-cache/src/test/workspace-root-cwd.ts`) is used by all THREE specs that
reach the real backend factory -- `actions-cache-backend.spec.ts`, `serve.spec.ts` and
`select-backend.spec.ts`. The draft only required a REVIEW of the third; it received the
hook. `publish-mirror.spec.ts` module-mocks the backend factory, so VER-04's guard never
runs there and it correctly did NOT get the hook.

**`status: passed`.** Consistent with `09-VERIFICATION.md` (`status: passed`, 11/11
code-verified) and `09-SECURITY.md` (`status: passed`, 72/72 threats verified, 0 open), and
with this audit's own finding that no requirement is left with prose-only or one-time-only
evidence where a standing check was feasible.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x (`@nx/vitest` inferred `test` target; `integration` declared in `packages/github-cache/project.json`) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit) and `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npx nx run @op-nx/github-cache:test --skip-nx-cache` |
| **Full suite command** | `npm run test` |
| **Measured at plan time** | ~3.4 s critical path on a cache miss; 35 spec files / 575 tests (at `565f48f`) |
| **Measured at this audit** | ~2.5 s critical path cache-bypassed; **38 spec files / 675 tests** at `84a470a` plus the three specs this audit edited |

The plan-time claim that existing infrastructure covers every unit-observable clause in
this phase HELD: no new framework, no new runner, no new config file, and the two gaps this
audit closed were both filled inside existing spec files.

**The one-OS fact that governs every row below.** The `test` job is `runs-on:
ubuntu-24.04-arm` (`ci.yml:337-338`); the Windows legs are XOS-04, Phase 12. So in CI every
unit spec samples exactly ONE OS. Any assertion whose VERDICT depends on the running
platform is therefore sampled at a rate of zero for the other platforms -- which is the
mechanism behind gap G2 below, and the reason LINT-02 bans ambient platform reads in specs
rather than merely discouraging them.

**Two cwd facts, unchanged and confirmed still true.** Under `nx test` the merged
configuration carries `options.cwd: "packages/github-cache"` and `vitest.config.mts` sets
`root: __dirname`, so `process.cwd()` is the PROJECT root and `existsSync(cwd/nx.json)` is
FALSE. VER-04's construction guard therefore throws in every spec that builds the real
backend unless the symmetrical `beforeAll`/`afterAll` `process.chdir()` is in place. The
same hook also puts the archive in the ROOT `.nx/cache`, the gitignored one.

---

## Sampling Rate

- **After every task commit:** `npx nx run @op-nx/github-cache:test --skip-nx-cache`
- **After every plan wave:** `npm run test` plus `npm run typecheck`
- **After every wave touching a `serve()`-reachable file:** `npm run check:action`
  (`build:action` + `git diff --exit-code`), and the diff is **INSPECTED, never assumed
  empty** -- Phase 7 saw an 88-line bundle drift caused by a lockfile re-resolution with no
  source edit.
- **Before `/gsd:verify-work`:** full suite green.
- **Max feedback latency:** ~2 s for `test`; the full local battery is the phase gate.

**PARITY-08 landed, so `.github/workflows/ci.yml` IS a `test` input** (`nx.json`
`targetDefaults.test.inputs`, pinned by `nx-target-inputs.spec.ts` in three clauses). Every
`ci.yml` edit now re-runs `test`. That is what stops DOCS-08's two `ci.yml` corrections,
VER-06's job assertions, and this audit's new ROBUST-04 job assertion from all serving a
stale cached PASS. This repo has shipped that false-pass class twice already
(`governance-email.spec.ts`, and `typecheck`'s spec-excluding inputs).

---

## Per-Requirement Verification Map

Scored COVERED / PARTIAL / MISSING against tests that actually exist and actually run at
`84a470a` plus this audit's additions. Sampling rate is judged, not just presence.

**Eleven IDs, not nine.** `ROADMAP.md`'s `**Requirements**:` line for this phase wraps
after `ROBUST-04,` and any parser that stops at the newline silently drops `OBS-04` and
`DOCS-08`. The correct list is used here and cross-checked against `REQUIREMENTS.md`'s own
text, matching `09-VERIFICATION.md`'s identical correction.

| Requirement | Unit-observable clause | Instrument (test count at audit) | Non-vacuity control -- and whether it is itself asserted | Verdict |
|---|---|---|---|---|
| PARITY-08 | the `ci.yml` entry survives the MERGED configuration | `nx-target-inputs.spec.ts` (24) | hostile LOCAL `project.json` copy declaring `inputs: ['default']` reddens clause 2, plus exact-equality on the replaced list so "passes because nothing resolved" is excluded -- ASSERTED | [OK] COVERED |
| VER-01 | the produced string is exactly `.nx/cache/nx-github-cache-abc123.tar` | `cache-archive-path.spec.ts` (47) | the literal is hand-authored, never rebuilt from the template; determinism and hash-sensitivity asserted separately -- ASSERTED | [OK] COVERED |
| VER-02 | the module names no path/os builder AND imports nothing but the `Hash` type | `cache-archive-path.spec.ts` clauses 2a/2b/2c | three-part control: each needle fires on its OWN derived probe token, fires on a code fixture, and stays silent on a comment-only fixture -- ASSERTED, and it is the strongest control in the phase | [OK] COVERED |
| VER-03 | per-call argument arrays incl. the flag's positional index (restoreCache 5th, saveCache 4th, probe 5th), per-function call counts, and a source-level count of exactly three reaches | `actions-cache-backend.spec.ts` (23) | clause 1 (whole recorded arrays, `toStrictEqual`) and clause 2 (ordered `cache.<member>` scan + namespace-import equality) are each other's control; the ordered-identity form defeats the bare-count mutation Phase 8 D-23 names -- ASSERTED | [OK] COVERED |
| VER-04 | the guard THROWS on a wrong cwd and on a diverging `GITHUB_WORKSPACE`; passes on the identity | `actions-cache-backend.spec.ts` | both conjuncts asserted as THROWS against separate temp fixtures, not just the happy path; `GITHUB_WORKSPACE` stubbed for CI-invariance -- ASSERTED | [OK] COVERED |
| VER-05 | the branch is on `=== ''` not the parsed semver; stderr-only output selects zstd; a **non-zero exit still selects zstd**; ENOENT selects gzip | `compression-method.spec.ts` (8) | the non-zero-exit case IS the control and is present -- the only case distinguishing a faithful port from a `runHelper`-shaped one or a `promisify(execFile)` rewrite; invocation shape and the deliberate timeout OMISSION asserted too -- ASSERTED | [OK] COVERED |
| VER-06 (leaf) | `dogfoodBody(hash,'linux')` differs from `dogfoodBody(hash,'windows')`, is deterministic per PAIR, and neither parameter carries a default | `dogfood-body.spec.ts` (5) | differing-bytes assertion (the parameter reaches the payload) plus `dogfoodBody.length === 2` (no default can silently reintroduce self-comparison) -- ASSERTED | [OK] COVERED |
| VER-06 (bin branch) | the verify branch's expected producer does NOT derive from the reader's platform | `action/index.spec.ts` (11) -- **2 cases added by this audit** | the ambient mapper is stubbed to each non-seed OS and the linux payload must STILL be accepted, with reader and producer named as different strings in one log line -- ASSERTED, machine-independently. **Was PARTIAL before this audit**: see gap G2 | [OK] COVERED |
| VER-06 (job shape) | `dogfood-verify` is a two-leg matrix with `fail-fast: false`; `dogfood-seed` declares NO matrix | `dogfood-cross-os.spec.ts` (5) | per-job block extraction with a positive control (`operation: seed` / `operation: verify` present) so the `not.toMatch` clauses cannot pass against an empty string -- ASSERTED | [OK] COVERED |
| VER-07 | `mkdirSync` runs at construction, before any write, and is recursive | `actions-cache-backend.spec.ts` | the directory is `rmSync`-removed and asserted ABSENT first, so the assertion cannot pass against Nx's own pre-existing directory -- ASSERTED | [OK] COVERED |
| ROBUST-04 (bundle) | the committed bundle matches a fresh build | `npm run check:action` (command, re-run in this audit: exit 0, empty diff) | the diff is inspected, never assumed empty; `git status` confirms the rebuild left nothing behind | [OK] COVERED |
| ROBUST-04 (sampler) | `action-bundle-drift` stays PR-eligible, i.e. carries no job-level `if:` | `dogfood-cross-os.spec.ts` -- **2 cases added by this audit** | positive control (the job block runs `npm run check:action`) precedes the absence clause; the `if:` needle is anchored at four spaces so a step-level `if:` is deliberately not matched -- ASSERTED. **Was MISSING before this audit**: see gap G1 | [OK] COVERED |
| OBS-04 (message) | the message names the axis and both candidate causes, carries the two-push reading instruction, and no longer names the OS one | `publish-mirror.spec.ts` (24) | three `restored as a MISS` assertions prove the branch is REACHED; the content assertions then prove WHAT it says; the retraction clause was HARDENED by this audit after a mutation proved the old form vacuously satisfiable -- ASSERTED | [OK] COVERED |
| DOCS-08 | each of the six sites carries its edit | `docs-same-os-claims.spec.ts` (21) | `DOCS_08_SITES` keyed on FILE + QUOTED PHRASE, not line number (the six edits shift each other's lines in one commit); three `forbidden` regexes with single-character character classes so the guard's own source cannot satisfy a repo-wide search; plus a four-file sweep for the retracted OBS-03 claim -- ASSERTED | [OK] COVERED |

**Verdict: 11/11 requirement IDs COVERED**, two of them only after the tests this audit
generated.

### The relaxation bound asked about explicitly

`read-back.spec.ts` (8 tests) was checked as a distinct question, because plan 09-08 traded
strictness for correctness and the trade has to stay bounded.

* **The four rejection classes are genuinely non-vacuous**, each for a stated mechanism:
  garbage bytes; a truncated upload (`subarray(0, 12)` -- `Buffer.equals` compares LENGTH
  first, so no candidate can match); an asset for a DIFFERENT hash using a
  SAME-LENGTH neighbouring run id (the only different-hash fixture that reddens a
  length-only or prefix-only comparator); and a cache MISS. A fifth clause covers the
  absent-`GITHUB_RUN_ID` input guard.
* **The relaxation is bounded at exactly two extra accepted byte strings per hash, and the
  bound is itself standing-tested.** `read-back.ts` accepts
  `CACHE_OS_VALUES.find((os) => bytes.equals(dogfoodBody(hash, os)))`, and
  `release-asset-name.spec.ts:101` pins `CACHE_OS_VALUES` by EQUALITY to
  `['windows', 'macos', 'linux']`. So growing the accepted set requires reddening that pin
  -- the bound cannot drift silently. Delta: 1 accepted producer before, 3 after.
* No presence check, no length-only check, no HIT-only check appears anywhere in the
  replacement.

---

## Gaps found and closed by this audit

Both were of the class the phase's own history warns about: a property whose only evidence
was prose, or a guard whose bite depended on which machine ran it. Each was mutation-tested
before AND after, so the closure is measured rather than asserted.

### G1 -- ROBUST-04's sampling MECHANISM was itself unsampled

**The gap.** `09-RESEARCH.md`'s validation table states ROBUST-04's sampling rate as "every
PR and every push", pre-merge availability "YES", on the strength of `action-bundle-drift`
carrying no `if:`. That job (`ci.yml:99-114`) is the ONLY standing control tying the
committed `start-cache-server/index.js` -- which four of the five sidecar `uses:` sites
execute -- to a fresh build. Its shape was asserted NOWHERE. Only three specs read `ci.yml`
(`nx-target-inputs`, `dogfood-cross-os`, `docs-same-os-claims`) and none of them named this
job. Adding `if: github.event_name == 'push'` to it -- the same gate that already makes
VER-06 and OBS-04 unobservable pre-merge, so the edit a reader is most likely to make while
believing they are being consistent -- would have silently dropped the bundle's only
standing sampler to push-to-`main` only, with every test green.

**The fix.** Two cases in `dogfood-cross-os.spec.ts`, reusing that file's existing
`jobBlock()` extractor rather than adding a second one, and placed there because the
VER-06/ROBUST-04 tie is the same fact about which event samples what. A positive control
(the block runs `npm run check:action`) precedes the absence clause.

**Mutation-tested.** Applied `if: github.event_name == 'push'` at `ci.yml:100`: exactly one
test reddened -- the intended one -- with the failure message naming the consequence.
Reverted; `ci.yml` byte-clean.

### G2 -- VER-06's verify-branch literal was guarded at a sampling rate of ZERO in CI

**The gap.** `action/index.ts` hardcodes `const expectedProducerOs = 'linux'` in the verify
branch, comment-locked by D-19/D-20/D-21 as the difference between a PROVENANCE check and a
presence check. The only automated check that it was not `cachePlatform()` was the
hand-authored literal payload in `action/index.spec.ts`'s setSecret test -- and that test's
BITE is platform-dependent: on ubuntu, the only OS the `test` job runs, the ambient value
IS `'linux'`, so the correct form and the substituted form are indistinguishable. A
substitution reddened only the live `dogfood-verify (windows-11-arm)` leg, which is
push-gated to `main` and therefore unobservable before a merge. This is precisely the
class 09-05 already found once in this same file (a hand-authored literal that gated
NOTHING because the test holding it only asserted `setSecret`).

**The fix.** A partial `vi.mock` of `../lib/release-asset-name.js` replacing only
`cachePlatform` (same `async (orig)` + spread idiom the file already uses for
`github-identity.js`), plus an `it.each` over `CACHE_OS_VALUES` MINUS the seed's OS -- so
reader OSes are derived from the real single-sourced tuple rather than spelled as "the OS
that is not this machine's", which is the form LINT-02 bans. Each case stubs the ambient
mapper to a non-seed OS, feeds the hand-authored LINUX literal, and asserts both acceptance
and the log line naming reader and producer as DIFFERENT strings -- reproducing the live
VER-06 log line machine-independently, at every-commit rate. The default stub value is the
seed's OS, so every pre-existing test in the file now reads a deterministic value instead
of whatever machine runs the suite.

**Mutation-tested, and the mutation is what proves the gap was real.** Replaced
`expectedProducerOs = 'linux'` with `cachePlatform()`: the two new cases reddened and
**every pre-existing test in the file stayed green**, including the one holding the pinned
literal. Reverted; `action/index.ts` byte-clean.

### G3 -- an existing OBS-04 guard passed for a reason unrelated to what it named

Not a coverage gap but the vacuity class the audit was asked to hunt, so it is recorded
with the same evidence standard.

**The finding.** `publish-mirror.spec.ts`'s retraction clause read
`expect(core.warning).toHaveBeenCalledWith(expect.not.stringMatching(/differen[t] OS/))`.
`toHaveBeenCalledWith` passes when ANY ONE call matches, so with a negated matcher the
assertion states "some warning lacks the phrase" -- not "no warning carries it". It was
non-vacuous only because that path happens to emit exactly one warning, which is a property
of the fixture and not of the claim.

**Mutation-tested both ways, which is the whole point.** Reintroduced the retracted
"different OS" explanation into the all-MISS message AND added a second, non-matching
`core.warning` on the same path. Under the OLD assertion form: **all 675 tests passed** --
the guard was satisfiable with the retracted claim back in the message. Under the hardened
form (`toHaveBeenCalledOnce` plus a `not.toContainEqual` over every recorded argument):
reddens. Reverted `publish-mirror.ts`; the hardened assertion is kept.

---

## Wave 0 Requirements

Existing infrastructure covered all phase requirements. No framework install, no new
fixtures file. Both accommodations landed WITH the code they serve:

- [OK] `actions-cache-backend.spec.ts` + `serve.spec.ts` -- symmetrical chdir hook, landed
      in the SAME commit as VER-04's guard (Hazard A: 16 + 1 real-backend constructions
      would redden otherwise). The hook also `mkdirSync`es the archive directory, because
      `actions-cache-backend.spec.ts` pre-writes at `cacheArchivePath(HASH)` BEFORE the
      construction that would create it -- one test's setup must not depend on a side
      effect of the code under test. Extracted to
      `packages/github-cache/src/test/workspace-root-cwd.ts` as
      `enterWorkspaceRootCwd()`.
- [OK] `select-backend.spec.ts` -- reviewed AND given the hook. It mocks `@actions/cache`
      but not the backend module, so its call sites reach the real factory on the
      write-trusted branch; the plan-time census correction (comment-locked at
      `actions-cache-backend.spec.ts`) records 21 construction sites across THREE files,
      against the research table's 15-plus-a-"probably".
- [OK] `publish-mirror.spec.ts` correctly did NOT get the hook -- it module-mocks the
      backend factory, so VER-04's guard never runs there.

---

## Manual-Only Verifications

**A spec runs in one process on one OS and CANNOT observe a two-OS property.** That is why
VER-06's load-bearing control is a job, not a test -- and why the Nyquist floor for the
cross-OS property is TWO OS legs. One leg samples one OS and cannot detect an
OS-partitioned store at any sampling rate. This remains the phase's canonical statement and
is unchanged by the audit.

**SUPERSEDED: the plan-time claim that "two `human_needed` items close this phase: VER-06
and OBS-04".** A maintainer-authorised TEMPORARY push to `main` (run `30400231720` at
`9ec4739`; `main` restored to `fe25a3f` under a `--force-with-lease`, with a pushed backup
tag taken first) SAMPLED both. A third item has since appeared. Current state:

| Behavior | Requirement | Status at this audit | Evidence / instruction |
|---|---|---|---|
| A `windows-11-arm` runner reads back the entry an `ubuntu-24.04-arm` runner wrote, and the body is LINUX-produced | VER-06 | **[OK] CLOSED LIVE** | `dogfood-verify (windows-11-arm)` job `90413113797`, conclusion SUCCESS on image `windows-11-arm64`, log line verbatim: `github-cache dogfood verify: cache HIT for 30400231720 on windows with bytes matching a 'linux'-produced payload.` `dogfood-seed` ran single-leg ubuntu as designed. Independently corroborated at the task layer: `publish (windows-11-arm)` restored the same four task hashes `publish (ubuntu-24.04-arm)` did. Re-samplable on every push to `main`. |
| The resolved compression method on each real runner image | VER-05 | **[OK] OBSERVED** | Both `publish` legs printed `compression method (@actions/cache): zstd-without-long`. The re-derived probe agrees with the library on real runners, which is the claim it existed to support. **Surfaced, never gated** -- no branch reads this value. |
| The one-time all-MISS rotation signal | OBS-04 | **[WARN] SAMPLED; mechanism and attribution CONFIRMED; the exact predicted rows NOT met; the window is SPENT** | See the reading below. Full record: the ADDENDUM at the end of `09-EVIDENCE.md`. |
| The cwd / `GITHUB_WORKSPACE` identity on a real Windows runner | VER-04 | **[OK] MEASURED** (2026-07-26, `PROBE-RESULTS.md` Q2) | This phase makes it ENFORCED rather than assumed. Available pre-merge via `integration`'s Windows leg. |
| Plan 09-08's live `publish-verify (windows-11-arm)` green | (gap closure, outside the eleven) | **[ ] OPEN** | Push-gated to `main` (`ci.yml:3-7` plus the job's `if: github.event_name == 'push'`), so not observable pre-merge. The closing observation is a `'linux'` producer named on the Windows leg: `github-cache round-trip read-back: cache HIT for <run_id> on win32 with bytes matching a 'linux'-produced payload`. Same category VER-06 and OBS-04 already carried; unlike OBS-04's signal it is re-samplable on every push. |

### OBS-04's live reading, stated precisely

Measured publish tables from run `30400231720`: ubuntu `scanned 47 / mirrored 6 /
skipped 41 / restore-MISS 41 / failed 0`; windows `scanned 48 / mirrored 7 / skipped 41 /
restore-MISS 41 / failed 0`; **no `restored as a MISS` warning on either leg.**

The advance prediction required `mirrored == 0` and `restore-MISS == scanned`. It was not
met. What WAS confirmed is the load-bearing half: the `restore-MISS` count is **SYMMETRIC
across both legs, 41 == 41**, which is the record's OWN pre-registered fingerprint for a
VER-01 PATH-caused rotation. A Windows-only asymmetry would have meant VER-03's flag landed
without VER-01's path (`cacheUtils.js:166` pushes `windows-only` only when
`!enableCrossOsArchive`, while the path components at `:159` push unconditionally). So the
mechanism and its attribution to VER-01 are confirmed. What failed is the all-or-nothing
FRAMING: `publish` runs late and enumerates a cache list that by then also contains this
same run's fresh new-version entries, which restore fine and get mirrored.

**The window is one-shot and now SPENT.** A later real merge will show a normal all-HIT
`publish`. A future reader comparing `09-ROTATION-SIGNAL.md` against the eventual merge run
will see all-HIT and wrongly conclude the prediction failed; it must be compared against
run `30400231720` and the `09-EVIDENCE.md` ADDENDUM, and nothing else. Recording a
non-match honestly is worth more than a claimed pass, and it is only legible as a non-match
because the prediction was committed (`e7018d0`) before the version-rotating commit
(`47597a6`).

### The trap that must be preserved VERBATIM

**A green VER-06 is NOT ROBUST-04 evidence.** `dogfood-seed`/`dogfood-verify` use
`./packages/github-cache`, whose `dist/action/index.js` is built from source in-job. They
never execute the committed `start-cache-server/index.js`, which is what four of the five
sidecar sites run. `action-bundle-drift` (no `if:` gate, `ci.yml:99-114`) is the only
control tying them together.

That last sentence was a PROSE assertion with no standing check until this audit; it is now
gap G1's test. The trap statement itself is unchanged and remains correct.

---

## Residuals -- honestly stated, not counted as compliance

1. **OBS-04's live rotation signal cannot be re-sampled. Sampling rate: exactly one
   observation, already taken, permanently unrepeatable.** This is a legitimate recorded
   outcome, not a fixable gap: the observable exists on the first `main` push after a
   version-affecting change and on no other run. Its unit-level half (message content, the
   no-fail gate) IS sampled at every-commit rate.
2. **The all-MISS tripwire can no longer fire for the FIRST of the two causes its own
   message advertises. Routed to Phase 10, NOT filed as a Phase 9 defect.** The gate is
   `readMisses === hashes.length && mirrored === 0` (`publish-mirror.ts:317`). The measured
   run proves a cache-VERSION rotation strands only PRE-rotation entries while the same
   run's fresh post-rotation entries restore and mirror -- so `mirrored > 0` and the branch
   is unreachable for cause 1, exactly as observed (41 misses, 6-7 hits, no warning). It
   remains reachable for cause 2 (a runtime-token read-scope regression, where nothing
   restores at all), which is the security-relevant one. The ADDENDUM already names the
   corrected observable: the restore-MISS COUNT and its SYMMETRY across legs, not the
   all-or-nothing equality. Changing the predicate is a semantic change to a shipped
   tripwire and belongs with OBS-05 in Phase 10; OBS-04's requirement text (the wording and
   the never-`setFailed` gate) is delivered and tested.
3. **One live-CI confirmation open:** plan 09-08's `publish-verify (windows-11-arm)`, per
   the table above. The property it confirms is fixture-tested (8 tests, RED -> GREEN) and
   mutation-tested at every-commit rate; only the environment realism is outstanding.
4. **Every unit spec samples ONE OS in CI** (`test` is ubuntu-only until XOS-04/Phase 12).
   This audit removed the two places where that mattered for a VERDICT (G1, G2). It is
   recorded as a standing property to re-check when a spec's assertion could depend on the
   platform, not as an open gap.

---

## Known and deliberate -- assessed, not re-opened

Recorded decisions with named owners, confirmed contained. None is filed as a gap.

- **Three plan-imposed one-commit TDD exceptions (09-03, 09-05, 09-06).** Each recorded a
  `## TDD Gate Compliance` section, each achieved ASSERTION-LEVEL RED (named tests failing
  on their own merits, suite completing) rather than an import-level failure, each carries a
  substantive reason (avoiding a further cache-version rotation window; refusing to commit
  a knowingly-RED tree). Maintainer reviewed and accepted; 09-08 used a normal RED -> GREEN
  split.
- **Two stale same-OS PROSE sites deferred to Phase 10 with named owners:**
  `publish-mirror.ts:146` / `:159` (plus `publish-mirror.spec.ts:410`), and `ci.yml`'s
  `publish-verify` job comment (flatly false about what `read-back.ts` now asserts). Neither
  is a security control (confirmed by `09-SECURITY.md`, `status: passed`, 72/72 verified, 0
  open). Containment checked: `docs-same-os-claims.spec.ts`'s two `ci.yml` rows key on the
  `publish` matrix comment and the `integration` comment, NEITHER on `publish-verify`, and
  `read-back.ts:128-137` names the stale job comment BY JOB so Phase 10 / TRUST-11 cannot be
  closed on the strength of `read-back.ts` having changed. Adequate as is -- a test pinning a
  known-stale sentence would only add a second place for the same fact to rot.
- **`governance-email.spec.ts`'s narrow four-file scope.** Not widened, per the security
  audit's proof that a blanket allowlist would fail on `start-cache-server/index.js`'s
  vendored license banner -- an upstream maintainer's OWN address, which the project's
  maintainer-scoped rule forbids blocking.

---

## Validation Sign-Off

- [OK] All eleven requirements have an `<automated>` verify or a named manual-only row
      above, and both rows that had only prose or a one-time check now have a standing test
- [OK] Sampling continuity: no 3 consecutive tasks without automated verify
- [OK] Wave 0 accommodations landed in the SAME commit as the code they serve, and reached
      all three specs that construct the real backend
- [OK] No watch-mode flags (`@nx/vitest` is configured `testMode: "watch"`; every
      invocation in this phase is the non-watch `nx run ...:test` form)
- [OK] Feedback latency < 5 s for the unit gate (~2 s measured)
- [OK] Every generated test mutation-tested: G1 one intended failure, G2 two intended
      failures with all pre-existing tests staying green, G3 old form proven passable and
      new form proven failing under the same mutation
- [OK] Every generated test machine-independent (no ambient platform read; reader OSes
      derived from `CACHE_OS_VALUES`), so `lint`'s LINT-02 ban stays green
- [OK] ASCII-only in all edited files; the plan-time draft's 32 non-ASCII characters are
      gone
- [OK] `nyquist_compliant: true` set in frontmatter, with the four residuals above stated
      rather than absorbed into the verdict

### Battery at the close of this audit

| Command | Result |
|---|---|
| `npm run format:check` | exit 0 |
| `npm run build` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run typecheck:action` | exit 0 |
| `npm run test` | **675 passed, 38 files** (was 671/38; +4 generated) |
| `npm run lint` | exit 0 |
| `npm run fallow:ci` | exit 0 |
| `npm run check:action` | exit 0, empty diff -- `git status` confirms the rebuild left the bundle clean |
| `npm run pack:check` | exit 0 |

**Approval:** audited 2026-07-29. Files changed by this audit:
`packages/github-cache/src/dogfood-cross-os.spec.ts` (+2 tests),
`packages/github-cache/src/action/index.spec.ts` (+2 tests),
`packages/github-cache/src/publish/publish-mirror.spec.ts` (assertion hardened), and this
file. Nothing committed -- the orchestrator commits.
